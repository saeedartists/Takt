import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  FamilyShareAccessError,
  runFamilyShareToday,
} from '../src/bots/family-share-today.js';
import { TAKT_EXT } from '../src/domain/constants.js';
import type {
  ConsentResource,
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
  dateTime: '2026-10-01T10:00:00Z',
  policyRule: { text: 'takt-family-sharing-v1' },
  provision: { type: 'permit', actor: [{ reference: { reference: 'RelatedPerson/rp-1' } }] },
};

const medication: MedicationResource = {
  resourceType: 'Medication',
  id: 'med-1',
  code: { text: 'Metformin 500 mg' },
  extension: [{ url: TAKT_EXT.strength, valueString: '500 mg' }],
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
          timeOfDay: ['08:00:00'],
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
    Medication: [medication],
    MedicationRequest: [request],
    ...overrides,
  });

describe('runFamilyShareToday', () => {
  it('returns today status for an active, linked share', async () => {
    const result = await runFamilyShareToday(
      { relativePatientRef: 'Patient/relative-1', relativeEmail: 'relative@example.com' },
      { fhir: fhirWith(), now },
    );

    expect(result.shares).toHaveLength(1);
    expect(result.shares[0]?.patientLabel).toBe('Ada Lovelace');
    expect(result.shares[0]?.doses[0]?.status).toBe('due');
    expect(result.shares[0]?.doses[0]?.label).toBe('Metformin 500 mg');
  });

  it('fails when the email has no linked invitation', async () => {
    await expect(
      runFamilyShareToday(
        { relativePatientRef: 'Patient/relative-1', relativeEmail: 'stranger@example.com' },
        { fhir: fhirWith(), now },
      ),
    ).rejects.toMatchObject({ reason: 'no-linked-invitation' });
  });

  it('fails when the grant was revoked', async () => {
    const fhir = fhirWith({ Consent: [{ ...consent, status: 'inactive' }] });
    await expect(
      runFamilyShareToday(
        { relativePatientRef: 'Patient/relative-1', relativeEmail: 'relative@example.com' },
        { fhir, now },
      ),
    ).rejects.toBeInstanceOf(FamilyShareAccessError);
  });

  it('ignores a consent that belongs to another relative', async () => {
    const fhir = fhirWith({
      Consent: [
        {
          ...consent,
          provision: { type: 'permit', actor: [{ reference: { reference: 'RelatedPerson/other' } }] },
        },
      ],
    });
    await expect(
      runFamilyShareToday(
        { relativePatientRef: 'Patient/relative-1', relativeEmail: 'relative@example.com' },
        { fhir, now },
      ),
    ).rejects.toMatchObject({ reason: 'no-active-share' });
  });
});
