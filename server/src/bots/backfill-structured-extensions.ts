import { TAKT_EXT } from '../domain/constants.js';
import { referenceId } from '../domain/references.js';
import {
  hasStructuredPauses,
  readAppearance,
  readPauseHistory,
  withAppearance,
  withPauseHistory,
} from '../domain/structured-extensions.js';
import type {
  FhirExtension,
  MedicationRequestResource,
  MedicationResource,
  PatientResource,
} from '../domain/types.js';
import type { FhirClient } from '../fhir.js';
import { searchAll } from '../fhir-queries.js';

/*
 * S-08 backfill. Phase 1 (default): add the structured extensions next to the
 * legacy JSON strings, so every record has the new shape. Phase 2
 * (`dropLegacy`, once no app build older than S-08 is in use): remove the
 * legacy strings. Idempotent; dry-run unless the caller opts in.
 */
export type StructuredExtensionBackfillOptions = {
  dryRun?: boolean;
  dropLegacy?: boolean;
  maxPatients?: number;
};

export type StructuredExtensionBackfillSummary = {
  requestsUpdated: number;
  medicationsUpdated: number;
  unchanged: number;
  failed: { reference: string; error: string }[];
};

const has = (extensions: FhirExtension[] | undefined, url: string) =>
  (extensions ?? []).some((x) => x.url === url);

export const runStructuredExtensionBackfill = async (
  fhir: FhirClient,
  options: StructuredExtensionBackfillOptions = {},
): Promise<StructuredExtensionBackfillSummary> => {
  const { dryRun = true, dropLegacy = false } = options;
  const summary: StructuredExtensionBackfillSummary = {
    requestsUpdated: 0,
    medicationsUpdated: 0,
    unchanged: 0,
    failed: [],
  };
  const patients = await searchAll<PatientResource>(
    fhir,
    'Patient',
    {},
    200,
    options.maxPatients ?? 100_000,
  );

  for (const patient of patients) {
    if (!patient.id) continue;
    const requests = await searchAll<MedicationRequestResource>(
      fhir,
      'MedicationRequest',
      { subject: `Patient/${patient.id}` },
      200,
    );

    for (const request of requests) {
      const needsStructured =
        has(request.extension, TAKT_EXT.pauseHistory) && !hasStructuredPauses(request.extension);
      const needsDrop = dropLegacy && has(request.extension, TAKT_EXT.pauseHistory);
      if (!needsStructured && !needsDrop) {
        summary.unchanged += 1;
        continue;
      }
      try {
        if (!dryRun) {
          await fhir.update({
            ...request,
            extension: withPauseHistory(
              request.extension,
              readPauseHistory(request.extension),
              dropLegacy,
            ),
          });
        }
        summary.requestsUpdated += 1;
      } catch (error) {
        summary.failed.push({
          reference: `MedicationRequest/${request.id ?? '?'}`,
          error: error instanceof Error ? error.message : 'backfill-failed',
        });
      }
    }

    const medicationIds = [
      ...new Set(
        requests
          .map((request) => referenceId(request.medicationReference?.reference))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    for (const medicationId of medicationIds) {
      try {
        const medication = await fhir.read<MedicationResource>(
          `/fhir/R4/Medication/${medicationId}`,
        );
        const appearance = readAppearance(medication.extension);
        const needsStructured =
          Boolean(appearance) && !has(medication.extension, TAKT_EXT.medicationAppearance);
        const needsDrop =
          dropLegacy && Boolean(appearance) && has(medication.extension, TAKT_EXT.appearance);
        if (!appearance || (!needsStructured && !needsDrop)) {
          summary.unchanged += 1;
          continue;
        }
        if (!dryRun) {
          await fhir.update({
            ...medication,
            extension: withAppearance(medication.extension, appearance, dropLegacy),
          });
        }
        summary.medicationsUpdated += 1;
      } catch (error) {
        summary.failed.push({
          reference: `Medication/${medicationId}`,
          error: error instanceof Error ? error.message : 'backfill-failed',
        });
      }
    }
  }

  return summary;
};
