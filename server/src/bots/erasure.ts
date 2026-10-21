import { PATIENT_SCOPE_SYSTEM } from '../domain/constants.js';
import { normalizeReference, referenceId } from '../domain/references.js';
import type { FhirClient } from '../fhir.js';
import { loadPatient, searchAll } from '../fhir-queries.js';
import type {
  CommunicationResource,
  ConsentResource,
  DeviceResource,
  MedicationAdministrationResource,
  MedicationRequestResource,
  MedicationResource,
  RelatedPersonResource,
} from '../domain/types.js';

export type ErasureInput = {
  patientRef: string;
  dryRun?: boolean;
};

export type ErasureDeps = {
  fhir: FhirClient;
};

export type ErasureSummary = {
  patientRef: string;
  deleted: Record<string, number>;
  failed: { path: string; error: string }[];
  patientDeleted: boolean;
};

const searchPaths = async (fhir: FhirClient, patientRef: string): Promise<string[]> => {
  const paths: string[] = [];
  const add = <T extends { id?: string }>(resourceType: string, resources: T[]): void => {
    for (const resource of resources) {
      if (resource.id) paths.push(`/fhir/R4/${resourceType}/${resource.id}`);
    }
  };

  const requests = await searchAll<MedicationRequestResource>(fhir, 'MedicationRequest', {
    subject: patientRef,
  });
  add('MedicationRequest', requests);

  const administrations = await searchAll<MedicationAdministrationResource>(
    fhir,
    'MedicationAdministration',
    { subject: patientRef },
  );
  add('MedicationAdministration', administrations);

  const consents = await searchAll<ConsentResource>(fhir, 'Consent', { patient: patientRef });
  add('Consent', consents);

  const relatedPeople = await searchAll<RelatedPersonResource>(fhir, 'RelatedPerson', {
    patient: patientRef,
  });
  add('RelatedPerson', relatedPeople);

  const devices = await searchAll<DeviceResource>(fhir, 'Device', { patient: patientRef });
  add('Device', devices);

  const communicationsBySubject = await searchAll<CommunicationResource>(fhir, 'Communication', {
    subject: patientRef,
  });
  const communicationsByRecipient = await searchAll<CommunicationResource>(fhir, 'Communication', {
    recipient: patientRef,
  });
  add('Communication', [...communicationsBySubject, ...communicationsByRecipient]);

  const medicationIds = new Set<string>();
  for (const request of requests) {
    const id = referenceId(request.medicationReference?.reference);
    if (id) medicationIds.add(id);
  }

  const patientId = referenceId(patientRef);
  if (patientId) {
    const medications = await searchAll<MedicationResource>(fhir, 'Medication', {
      identifier: `${PATIENT_SCOPE_SYSTEM}|${patientId}`,
    });
    for (const medication of medications) {
      if (medication.id) medicationIds.add(medication.id);
    }
  }

  for (const id of medicationIds) {
    paths.push(`/fhir/R4/Medication/${id}`);
  }

  return [...new Set(paths)];
};

export const runErasure = async (input: ErasureInput, deps: ErasureDeps): Promise<ErasureSummary> => {
  const patientRef = normalizeReference(input.patientRef) ?? input.patientRef;
  const patient = await loadPatient(deps.fhir, patientRef);
  if (!patient.id) throw new Error('Patient id is required for erasure.');

  const summary: ErasureSummary = {
    patientRef,
    deleted: {},
    failed: [],
    patientDeleted: false,
  };

  const paths = await searchPaths(deps.fhir, patientRef);
  for (const path of paths) {
    const resourceType = path.split('/')[3] ?? 'Unknown';
    if (input.dryRun) {
      summary.deleted[resourceType] = (summary.deleted[resourceType] ?? 0) + 1;
      continue;
    }
    try {
      await deps.fhir.delete(path);
      summary.deleted[resourceType] = (summary.deleted[resourceType] ?? 0) + 1;
    } catch (error) {
      summary.failed.push({ path, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (input.dryRun) {
    summary.deleted.Patient = 1;
    return summary;
  }

  if (summary.failed.length > 0) {
    throw Object.assign(new Error('Erasure completed with failures; Patient was not deleted.'), {
      summary,
    });
  }

  try {
    await deps.fhir.delete(`/fhir/R4/Patient/${patient.id}`);
    summary.deleted.Patient = 1;
    summary.patientDeleted = true;
  } catch (error) {
    summary.failed.push({
      path: `/fhir/R4/Patient/${patient.id}`,
      error: error instanceof Error ? error.message : String(error),
    });
    throw Object.assign(new Error('Erasure failed while deleting the Patient.'), { summary });
  }

  return summary;
};
