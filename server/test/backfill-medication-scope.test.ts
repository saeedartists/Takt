import { describe, expect, it } from 'vitest';
import { runMedicationScopeBackfill } from '../src/bots/backfill-medication-scope.js';
import { PATIENT_SCOPE_SYSTEM } from '../src/domain/constants.js';
import type {
  MedicationRequestResource,
  MedicationResource,
  PatientResource,
} from '../src/domain/types.js';
import { createFakeFhir } from './fake-fhir.js';

const patient = (id: string): PatientResource => ({ resourceType: 'Patient', id });

const request = (id: string, patientId: string, medicationId: string): MedicationRequestResource => ({
  resourceType: 'MedicationRequest',
  id,
  status: 'active',
  subject: { reference: `Patient/${patientId}` },
  medicationReference: { reference: `Medication/${medicationId}` },
});

const medication = (id: string): MedicationResource => ({
  resourceType: 'Medication',
  id,
  code: { text: 'Metformin' },
});

describe('runMedicationScopeBackfill', () => {
  it('backfills missing patient scope identifiers without touching already-scoped records', async () => {
    const fhir = createFakeFhir({
      Patient: [patient('p-1')],
      MedicationRequest: [request('req-1', 'p-1', 'med-1'), request('req-2', 'p-1', 'med-2')],
      Medication: [
        medication('med-1'),
        {
          ...medication('med-2'),
          identifier: [{ system: PATIENT_SCOPE_SYSTEM, value: 'p-1' }],
        },
      ],
    });
    const updated: MedicationResource[] = [];
    fhir.update = async (resource) => {
      updated.push(resource as MedicationResource);
      return resource;
    };

    const summary = await runMedicationScopeBackfill(fhir);

    expect(summary.updatedCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
    expect(updated[0]?.identifier).toEqual([{ system: PATIENT_SCOPE_SYSTEM, value: 'p-1' }]);
  });

  it('does not write in dry-run mode', async () => {
    const fhir = createFakeFhir({
      Patient: [patient('p-1')],
      MedicationRequest: [request('req-1', 'p-1', 'med-1')],
      Medication: [medication('med-1')],
    });
    let updates = 0;
    fhir.update = async (resource) => {
      updates += 1;
      return resource;
    };

    const summary = await runMedicationScopeBackfill(fhir, { dryRun: true });
    expect(summary.updatedCount).toBe(1);
    expect(updates).toBe(0);
  });

  it('reports a medication already scoped to another patient instead of overwriting it', async () => {
    const fhir = createFakeFhir({
      Patient: [patient('p-1')],
      MedicationRequest: [request('req-1', 'p-1', 'med-1')],
      Medication: [
        {
          ...medication('med-1'),
          identifier: [{ system: PATIENT_SCOPE_SYSTEM, value: 'p-2' }],
        } as MedicationResource,
      ],
    });

    const summary = await runMedicationScopeBackfill(fhir);
    expect(summary.conflicts).toEqual([{ medicationId: 'med-1', patientId: 'p-1' }]);
    expect(summary.updatedCount).toBe(0);
  });
});
