import { PATIENT_SCOPE_SYSTEM } from '../domain/constants.js';
import { referenceId } from '../domain/references.js';
import type {
  MedicationRequestResource,
  MedicationResource,
  PatientResource,
} from '../domain/types.js';
import type { FhirClient } from '../fhir.js';
import { searchAll } from '../fhir-queries.js';

export type MedicationScopeBackfillOptions = {
  dryRun?: boolean;
  maxPatients?: number;
};

export type MedicationScopeBackfillSummary = {
  patientCount: number;
  medicationCount: number;
  updatedCount: number;
  skippedCount: number;
  conflicts: { medicationId: string; patientId: string }[];
  failed: { medicationId: string; error: string }[];
};

export const runMedicationScopeBackfill = async (
  fhir: FhirClient,
  options: MedicationScopeBackfillOptions = {},
): Promise<MedicationScopeBackfillSummary> => {
  const summary: MedicationScopeBackfillSummary = {
    patientCount: 0,
    medicationCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    conflicts: [],
    failed: [],
  };
  const patients = await searchAll<PatientResource>(fhir, 'Patient', {}, 200, options.maxPatients ?? 100_000);

  for (const patient of patients) {
    if (!patient.id) continue;
    summary.patientCount += 1;
    const requests = await searchAll<MedicationRequestResource>(
      fhir,
      'MedicationRequest',
      { subject: `Patient/${patient.id}` },
      200,
    );
    const medicationIds = [
      ...new Set(
        requests
          .map((request) => referenceId(request.medicationReference?.reference))
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    for (const medicationId of medicationIds) {
      summary.medicationCount += 1;
      try {
        const medication = await fhir.read<MedicationResource>(`/fhir/R4/Medication/${medicationId}`);
        const scopeIdentifiers = (medication.identifier ?? []).filter(
          (identifier) => identifier.system === PATIENT_SCOPE_SYSTEM,
        );
        if (scopeIdentifiers.some((identifier) => identifier.value === patient.id)) {
          summary.skippedCount += 1;
          continue;
        }
        if (scopeIdentifiers.length > 0) {
          summary.conflicts.push({ medicationId, patientId: patient.id });
          continue;
        }
        if (!options.dryRun) {
          await fhir.update({
            ...medication,
            identifier: [
              ...(medication.identifier ?? []),
              { system: PATIENT_SCOPE_SYSTEM, value: patient.id },
            ],
          });
        }
        summary.updatedCount += 1;
      } catch (error) {
        summary.failed.push({
          medicationId,
          error: error instanceof Error ? error.message : 'backfill-failed',
        });
      }
    }
  }

  return summary;
};
