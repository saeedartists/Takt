import { DateTime } from 'luxon';
import { describe, expect, it, vi } from 'vitest';
import { runFamilyShareUnconfirmed } from '../src/bots/family-share-unconfirmed.js';
import { EXPO_PUSH_TOKEN_SYSTEM, TAKT_EXT } from '../src/domain/constants.js';
import type {
  ConsentResource,
  DeviceResource,
  MedicationRequestResource,
  MedicationResource,
  PatientResource,
  RelatedPersonResource,
} from '../src/domain/types.js';
import { createFakeFhir } from './fake-fhir.js';

const zone = 'Europe/Berlin';
const now = DateTime.fromISO('2026-10-20T10:00:00', { zone });

const patient: PatientResource = {
  resourceType: 'Patient',
  id: 'p-1',
  name: [{ given: ['Ada'], family: 'Lovelace' }],
  extension: [{ url: TAKT_EXT.patientTimezone, valueString: zone }],
};

const relatedPerson: RelatedPersonResource = {
  resourceType: 'RelatedPerson',
  id: 'rp-1',
  active: true,
  patient: { reference: 'Patient/p-1' },
  telecom: [{ system: 'email', value: 'relative@example.com' }],
  extension: [{ url: TAKT_EXT.familyShareLinkedAccount, valueString: 'Patient/relative-1' }],
};

const consent: ConsentResource = {
  resourceType: 'Consent',
  id: 'consent-1',
  status: 'active',
  patient: { reference: 'Patient/p-1' },
  policyRule: { text: 'takt-family-sharing-v1' },
  provision: { type: 'permit', actor: [{ reference: { reference: 'RelatedPerson/rp-1' } }] },
};

const device: DeviceResource = {
  resourceType: 'Device',
  id: 'device-1',
  status: 'active',
  patient: { reference: 'Patient/relative-1' },
  identifier: [{ system: EXPO_PUSH_TOKEN_SYSTEM, value: 'ExponentPushToken[test-token]' }],
};

const medication: MedicationResource = {
  resourceType: 'Medication',
  id: 'med-1',
  code: { text: 'Metformin 500 mg' },
};

const request: MedicationRequestResource = {
  resourceType: 'MedicationRequest',
  id: 'req-1',
  status: 'active',
  subject: { reference: 'Patient/p-1' },
  medicationReference: { reference: 'Medication/med-1' },
  authoredOn: '2026-10-01T00:00:00Z',
  dosageInstruction: [
    {
      timing: {
        repeat: {
          frequency: 1,
          period: 1,
          periodUnit: 'd',
          timeOfDay: ['06:00:00'],
        },
      },
    },
  ],
};

const fhirWith = (overrides: Record<string, unknown[]> = {}) =>
  createFakeFhir({
    Patient: [patient],
    RelatedPerson: [relatedPerson],
    Consent: [consent],
    Device: [device],
    Medication: [medication],
    MedicationRequest: [request],
    ...overrides,
  });

describe('runFamilyShareUnconfirmed', () => {
  it('sends one push and records a Communication, then skips the duplicate', async () => {
    const fhir = fhirWith();
    const sendPush = vi.fn(async () => [{ ok: true }]);
    const options = { now, unconfirmedHours: 2 };

    const first = await runFamilyShareUnconfirmed({ patientRef: 'Patient/p-1' }, { fhir, sendPush }, options);
    expect(first.unconfirmedDoseCount).toBe(1);
    expect(first.sentCount).toBe(1);
    expect(fhir.created).toHaveLength(1);
    expect(fhir.created[0]?.resourceType).toBe('Communication');
    expect((fhir.created[0] as { subject?: { reference?: string } }).subject?.reference).toBe('Patient/p-1');

    const second = await runFamilyShareUnconfirmed({ patientRef: 'Patient/p-1' }, { fhir, sendPush }, options);
    expect(second.skippedCount).toBe(1);
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it('covers a dose just before midnight when the bot runs after midnight', async () => {
    const fhir = fhirWith({
      MedicationRequest: [
        {
          ...request,
          dosageInstruction: [
            {
              timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd', timeOfDay: ['23:30:00'] } },
            },
          ],
        },
      ],
    });
    const afterMidnight = DateTime.fromISO('2026-10-21T01:30:00', { zone });
    const sendPush = vi.fn(async () => [{ ok: true }]);

    const result = await runFamilyShareUnconfirmed(
      { patientRef: 'Patient/p-1' },
      { fhir, sendPush },
      { now: afterMidnight, quietHours: { startHour: 8, endHour: 8 } },
    );

    expect(result.unconfirmedDoseCount).toBe(1);
    expect(result.sentCount).toBe(1);
  });

  it('does nothing during quiet hours', async () => {
    const fhir = fhirWith();
    const sendPush = vi.fn(async () => [{ ok: true }]);
    const quietNow = DateTime.fromISO('2026-10-20T22:00:00', { zone });
    const result = await runFamilyShareUnconfirmed(
      { patientRef: 'Patient/p-1' },
      { fhir, sendPush },
      { now: quietNow },
    );
    expect(result.unconfirmedDoseCount).toBe(0);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('reports a missing push token instead of failing silently', async () => {
    const fhir = fhirWith({ Device: [] });
    const result = await runFamilyShareUnconfirmed(
      { patientRef: 'Patient/p-1' },
      { fhir, sendPush: vi.fn(async () => [{ ok: true }]) },
      { now },
    );
    expect(result.blockers).toContain('no-push-token');
    expect(result.sentCount).toBe(0);
  });

  it("does not send to the sharing patient's own device", async () => {
    const fhir = fhirWith({
      Device: [{ ...device, patient: { reference: 'Patient/p-1' } }],
    });
    const result = await runFamilyShareUnconfirmed(
      { patientRef: 'Patient/p-1' },
      { fhir, sendPush: vi.fn(async () => [{ ok: true }]) },
      { now },
    );
    expect(result.blockers).toContain('no-push-token');
    expect(result.sentCount).toBe(0);
  });

  it('releases the claim when every push fails', async () => {
    const fhir = fhirWith();
    const result = await runFamilyShareUnconfirmed(
      { patientRef: 'Patient/p-1' },
      { fhir, sendPush: vi.fn(async () => [{ ok: false, error: 'DeviceNotRegistered', invalidToken: true }]) },
      { now },
    );
    expect(result.failedCount).toBe(1);
    expect(fhir.created).toHaveLength(1);
    expect(fhir.deleted).toHaveLength(1);
    expect(fhir.resources.get('Communication')).toHaveLength(0);
    expect(
      (fhir.updated.find((resource) => resource.id === 'device-1') as DeviceResource | undefined)
        ?.status,
    ).toBe('inactive');
  });

  it('reports a FHIR write failure when the communication cannot be completed', async () => {
    const fhir = fhirWith();
    fhir.update = async () => {
      throw new Error('write failed');
    };

    const result = await runFamilyShareUnconfirmed(
      { patientRef: 'Patient/p-1' },
      { fhir, sendPush: vi.fn(async () => [{ ok: true }]) },
      { now },
    );

    expect(result.sentCount).toBe(1);
    expect(result.writeFailureCount).toBe(1);
    expect(result.blockers).toContain('communication-write-failed');
  });

  it('does not send when the claim cannot be created', async () => {
    const fhir = fhirWith();
    fhir.create = async () => {
      throw new Error('write failed');
    };
    const sendPush = vi.fn(async () => [{ ok: true }]);

    const result = await runFamilyShareUnconfirmed(
      { patientRef: 'Patient/p-1' },
      { fhir, sendPush },
      { now },
    );

    expect(result.sentCount).toBe(0);
    expect(result.writeFailureCount).toBe(1);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('uses a conditional create so concurrent runs cannot duplicate the audit record', async () => {
    const fhir = fhirWith();
    const sendPush = vi.fn(async () => [{ ok: true }]);

    await Promise.all([
      runFamilyShareUnconfirmed({ patientRef: 'Patient/p-1' }, { fhir, sendPush }, { now }),
      runFamilyShareUnconfirmed({ patientRef: 'Patient/p-1' }, { fhir, sendPush }, { now }),
    ]);

    expect(fhir.created.filter((resource) => resource.resourceType === 'Communication')).toHaveLength(1);
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it('does not send or write in dry-run mode', async () => {
    const fhir = fhirWith();
    const sendPush = vi.fn(async () => [{ ok: true }]);
    const result = await runFamilyShareUnconfirmed(
      { patientRef: 'Patient/p-1' },
      { fhir, sendPush },
      { now, dryRun: true },
    );

    expect(result.unconfirmedDoseCount).toBe(1);
    expect(result.sentCount).toBe(0);
    expect(result.wouldSendCount).toBe(1);
    expect(sendPush).not.toHaveBeenCalled();
    expect(fhir.created).toHaveLength(0);
  });
});
