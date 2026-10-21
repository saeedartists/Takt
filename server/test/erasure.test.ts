import { describe, expect, it } from 'vitest';
import { runErasure } from '../src/bots/erasure.js';
import { PATIENT_SCOPE_SYSTEM } from '../src/domain/constants.js';
import type {
  CommunicationResource,
  ConsentResource,
  DeviceResource,
  MedicationAdministrationResource,
  MedicationRequestResource,
  MedicationResource,
  PatientResource,
  RelatedPersonResource,
} from '../src/domain/types.js';
import { createFakeFhir } from './fake-fhir.js';

const patient: PatientResource = {
  resourceType: 'Patient',
  id: 'p-1',
};

const resources = {
  Patient: [patient],
  MedicationRequest: [
    {
      resourceType: 'MedicationRequest',
      id: 'req-1',
      status: 'active',
      subject: { reference: 'Patient/p-1' },
      medicationReference: { reference: 'Medication/med-1' },
    } satisfies MedicationRequestResource,
  ],
  MedicationAdministration: [
    {
      resourceType: 'MedicationAdministration',
      id: 'adm-1',
      status: 'completed',
      subject: { reference: 'Patient/p-1' },
    } satisfies MedicationAdministrationResource,
  ],
  Medication: [
    {
      resourceType: 'Medication',
      id: 'med-1',
    } satisfies MedicationResource,
    {
      resourceType: 'Medication',
      id: 'med-2',
      identifier: [{ system: PATIENT_SCOPE_SYSTEM, value: 'p-1' }],
    } satisfies MedicationResource,
  ],
  Consent: [
    {
      resourceType: 'Consent',
      id: 'consent-1',
      status: 'active',
      patient: { reference: 'Patient/p-1' },
    } satisfies ConsentResource,
  ],
  RelatedPerson: [
    {
      resourceType: 'RelatedPerson',
      id: 'rp-1',
      patient: { reference: 'Patient/p-1' },
    } satisfies RelatedPersonResource,
  ],
  Device: [
    {
      resourceType: 'Device',
      id: 'device-1',
      status: 'active',
      patient: { reference: 'Patient/p-1' },
    } satisfies DeviceResource,
  ],
  Communication: [
    {
      resourceType: 'Communication',
      id: 'comm-1',
      status: 'completed',
      recipient: [{ reference: 'Patient/p-1' }],
    } satisfies CommunicationResource,
  ],
};

describe('runErasure', () => {
  it('deletes every patient-owned resource and then the Patient', async () => {
    const fhir = createFakeFhir(resources);
    const summary = await runErasure({ patientRef: 'Patient/p-1' }, { fhir });

    expect(summary.deleted.MedicationRequest).toBe(1);
    expect(summary.deleted.MedicationAdministration).toBe(1);
    expect(summary.deleted.Medication).toBe(2);
    expect(summary.deleted.Consent).toBe(1);
    expect(summary.deleted.RelatedPerson).toBe(1);
    expect(summary.deleted.Device).toBe(1);
    expect(summary.deleted.Communication).toBe(1);
    expect(summary.deleted.Patient).toBe(1);
    expect(summary.patientDeleted).toBe(true);
    expect(fhir.deleted).toContain('/fhir/R4/Patient/p-1');
    expect(summary.failed).toHaveLength(0);
  });

  it('does not delete anything in dry-run mode', async () => {
    const fhir = createFakeFhir(resources);
    const summary = await runErasure({ patientRef: 'Patient/p-1', dryRun: true }, { fhir });

    expect(fhir.deleted).toHaveLength(0);
    expect(summary.patientDeleted).toBe(false);
    expect(summary.deleted.Patient).toBe(1);
    expect(summary.deleted.MedicationRequest).toBe(1);
  });

  it('keeps the Patient when an owned resource cannot be deleted', async () => {
    const fhir = createFakeFhir(resources);
    const originalDelete = fhir.delete;
    fhir.delete = async (path: string) => {
      if (path.endsWith('/Medication/med-1')) throw new Error('locked');
      await originalDelete(path);
    };

    await expect(runErasure({ patientRef: 'Patient/p-1' }, { fhir })).rejects.toMatchObject({
      summary: {
        patientDeleted: false,
        failed: [{ path: '/fhir/R4/Medication/med-1', error: 'locked' }],
      },
    });
    expect(fhir.deleted).not.toContain('/fhir/R4/Patient/p-1');
  });
});
