import { DateTime } from 'luxon';
import { describe, expect, it, vi } from 'vitest';
import { runFamilyShareUnconfirmedScan } from '../src/bots/family-share-scan.js';
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

const patient = (id: string): PatientResource => ({
  resourceType: 'Patient',
  id,
  name: [{ given: ['Ada'], family: id }],
  extension: [{ url: TAKT_EXT.patientTimezone, valueString: zone }],
});

const relatedPerson = (id: string, patientId: string, relativeId: string): RelatedPersonResource => ({
  resourceType: 'RelatedPerson',
  id,
  active: true,
  patient: { reference: `Patient/${patientId}` },
  telecom: [{ system: 'email', value: `${relativeId}@example.com` }],
  extension: [{ url: TAKT_EXT.familyShareLinkedAccount, valueString: `Patient/${relativeId}` }],
});

const consent = (id: string, patientId: string, relatedPersonId: string): ConsentResource => ({
  resourceType: 'Consent',
  id,
  status: 'active',
  patient: { reference: `Patient/${patientId}` },
  policyRule: { text: 'takt-family-sharing-v1' },
  provision: {
    type: 'permit',
    actor: [{ reference: { reference: `RelatedPerson/${relatedPersonId}` } }],
  },
});

const device = (id: string, relativeId: string): DeviceResource => ({
  resourceType: 'Device',
  id,
  status: 'active',
  patient: { reference: `Patient/${relativeId}` },
  identifier: [{ system: EXPO_PUSH_TOKEN_SYSTEM, value: `ExponentPushToken[token-${id}]` }],
});

const medication = (id: string): MedicationResource => ({
  resourceType: 'Medication',
  id,
  code: { text: 'Metformin 500 mg' },
});

const request = (id: string, patientId: string): MedicationRequestResource => ({
  resourceType: 'MedicationRequest',
  id,
  status: 'active',
  subject: { reference: `Patient/${patientId}` },
  medicationReference: { reference: 'Medication/med-1' },
  authoredOn: '2026-10-01T00:00:00Z',
  dosageInstruction: [
    {
      timing: {
        repeat: { frequency: 1, period: 1, periodUnit: 'd', timeOfDay: ['06:00:00'] },
      },
    },
  ],
});

const fhirWithTwoPatients = () =>
  createFakeFhir({
    Patient: [patient('p-1'), patient('p-2')],
    RelatedPerson: [relatedPerson('rp-1', 'p-1', 'relative-1'), relatedPerson('rp-2', 'p-2', 'relative-2')],
    Consent: [consent('consent-1', 'p-1', 'rp-1'), consent('consent-2', 'p-2', 'rp-2')],
    Device: [device('device-1', 'relative-1'), device('device-2', 'relative-2')],
    Medication: [medication('med-1')],
    MedicationRequest: [request('req-1', 'p-1'), request('req-2', 'p-2')],
  });

describe('runFamilyShareUnconfirmedScan', () => {
  it('processes active family-share patients with bounded concurrency', async () => {
    const fhir = fhirWithTwoPatients();
    const sendPush = vi.fn(async (messages: unknown[]) => messages.map(() => ({ ok: true as const })));

    const result = await runFamilyShareUnconfirmedScan(
      { fhir, sendPush },
      { now, concurrency: 2, quietHours: { startHour: 8, endHour: 8 } },
    );

    expect(result.patientCount).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((entry) => 'summary' in entry)).toBe(true);
    for (const entry of result.results) {
      if ('summary' in entry) expect(entry.summary.sentCount).toBe(1);
    }
    expect(sendPush).toHaveBeenCalledTimes(2);
  });

  it('deduplicates patients and returns a cursor for the next page', async () => {
    const fhir = fhirWithTwoPatients();
    const consentList = fhir.resources.get('Consent') ?? [];
    fhir.resources.set('Consent', [...consentList, consent('consent-duplicate', 'p-1', 'rp-1')]);

    const firstPage = await runFamilyShareUnconfirmedScan(
      { fhir, sendPush: vi.fn(async (messages: unknown[]) => messages.map(() => ({ ok: true as const }))) },
      { now, maxPatients: 1, quietHours: { startHour: 8, endHour: 8 } },
    );
    expect(firstPage.patientCount).toBe(1);
    expect(firstPage.nextOffset).toBe(1);
  });

  it('isolates a single patient failure from the rest of the scan', async () => {
    const fhir = fhirWithTwoPatients();
    fhir.resources.set('Patient', [patient('p-1')]);

    const result = await runFamilyShareUnconfirmedScan(
      { fhir, sendPush: vi.fn(async (messages: unknown[]) => messages.map(() => ({ ok: true as const }))) },
      { now, quietHours: { startHour: 8, endHour: 8 } },
    );

    expect(result.results).toHaveLength(2);
    expect(result.results.some((entry) => 'error' in entry)).toBe(true);
    expect(result.results.some((entry) => 'summary' in entry && entry.summary.sentCount === 1)).toBe(true);
  });
});
