import type {
  ConsentResource,
  FhirReference,
  MedicationAdministrationResource,
  MedicationRequestResource,
  MedicationResource,
  PatientResource,
  RelatedPersonResource,
} from './types';

export type ValidationIssue = {
  field: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

const refPattern = /^[A-Z][A-Za-z]+\/[A-Za-z0-9\-\.]{1,128}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export const isValidReference = (value?: string): boolean => (value ? refPattern.test(value) : false);

const checkReference = (issues: ValidationIssue[], field: string, ref?: FhirReference): void => {
  if (!ref?.reference || !isValidReference(ref.reference)) {
    issues.push({ field, message: 'Reference must be in ResourceType/id format.' });
  }
};

const checkIsoDateTime = (issues: ValidationIssue[], field: string, value?: string): void => {
  if (!value || !isoPattern.test(value)) {
    issues.push({ field, message: 'DateTime must be an ISO UTC string (YYYY-MM-DDTHH:mm:ss.sssZ).' });
  }
};

export const validatePatientResource = (resource: PatientResource): ValidationResult => {
  const issues: ValidationIssue[] = [];
  if (resource.resourceType !== 'Patient') issues.push({ field: 'resourceType', message: 'Must be Patient.' });
  if (!resource.id) issues.push({ field: 'id', message: 'Patient id is required.' });
  return { ok: issues.length === 0, issues };
};

export const validateMedicationResource = (resource: MedicationResource): ValidationResult => {
  const issues: ValidationIssue[] = [];
  if (resource.resourceType !== 'Medication') issues.push({ field: 'resourceType', message: 'Must be Medication.' });
  if (!resource.id) issues.push({ field: 'id', message: 'Medication id is required.' });
  if (!resource.code?.text?.trim()) {
    issues.push({ field: 'code.text', message: 'Medication label is required.' });
  }
  return { ok: issues.length === 0, issues };
};

export const validateMedicationRequestResource = (resource: MedicationRequestResource): ValidationResult => {
  const issues: ValidationIssue[] = [];

  if (resource.resourceType !== 'MedicationRequest') {
    issues.push({ field: 'resourceType', message: 'Must be MedicationRequest.' });
  }

  if (!resource.id) issues.push({ field: 'id', message: 'MedicationRequest id is required.' });

  if (!['active', 'on-hold', 'stopped', 'completed', 'draft'].includes(resource.status)) {
    issues.push({ field: 'status', message: 'MedicationRequest status is not in expected enum.' });
  }

  checkReference(issues, 'subject', resource.subject);
  checkReference(issues, 'medicationReference', resource.medicationReference);

  const times = resource.dosageInstruction?.[0]?.timing?.repeat?.timeOfDay ?? [];
  if (times.length === 0) {
    issues.push({ field: 'dosageInstruction[0].timing.repeat.timeOfDay', message: 'At least one time is required.' });
  }

  if (times.some((t) => !timePattern.test(t))) {
    issues.push({ field: 'timeOfDay', message: 'Dose times must use HH:MM 24-hour format.' });
  }

  return { ok: issues.length === 0, issues };
};

export const validateMedicationAdministrationResource = (
  resource: MedicationAdministrationResource,
): ValidationResult => {
  const issues: ValidationIssue[] = [];

  if (resource.resourceType !== 'MedicationAdministration') {
    issues.push({ field: 'resourceType', message: 'Must be MedicationAdministration.' });
  }

  if (!resource.id) issues.push({ field: 'id', message: 'MedicationAdministration id is required.' });

  if (!['completed', 'not-done'].includes(resource.status)) {
    issues.push({ field: 'status', message: 'MedicationAdministration status must be completed or not-done.' });
  }

  checkReference(issues, 'subject', resource.subject);
  checkReference(issues, 'request', resource.request);
  checkReference(issues, 'medicationReference', resource.medicationReference);

  checkIsoDateTime(issues, 'effectiveDateTime', resource.effectiveDateTime);

  return { ok: issues.length === 0, issues };
};

export const validateConsentResource = (resource: ConsentResource): ValidationResult => {
  const issues: ValidationIssue[] = [];

  if (resource.resourceType !== 'Consent') {
    issues.push({ field: 'resourceType', message: 'Must be Consent.' });
  }

  if (!['active', 'inactive', 'draft'].includes(resource.status)) {
    issues.push({ field: 'status', message: 'Consent status must be active, inactive, or draft.' });
  }

  checkReference(issues, 'patient', resource.patient);
  checkIsoDateTime(issues, 'dateTime', resource.dateTime);

  if (!resource.scope?.coding?.[0]?.code) {
    issues.push({ field: 'scope.coding[0].code', message: 'Consent scope coding is required.' });
  }

  if (!resource.category?.[0]?.coding?.[0]?.code) {
    issues.push({ field: 'category[0].coding[0].code', message: 'Consent category coding is required.' });
  }

  return { ok: issues.length === 0, issues };
};

export const validateRelatedPersonResource = (resource: RelatedPersonResource): ValidationResult => {
  const issues: ValidationIssue[] = [];
  if (resource.resourceType !== 'RelatedPerson') {
    issues.push({ field: 'resourceType', message: 'Must be RelatedPerson.' });
  }
  checkReference(issues, 'patient', resource.patient);
  if (!resource.name?.[0]?.family && !resource.name?.[0]?.given?.[0]) {
    issues.push({ field: 'name[0]', message: 'RelatedPerson must include a usable display name.' });
  }
  return { ok: issues.length === 0, issues };
};

export const validateMedicationGraphIntegrity = (input: {
  patientRef: string;
  medications: MedicationResource[];
  medicationRequests: MedicationRequestResource[];
  administrations: MedicationAdministrationResource[];
}): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const medicationSet = new Set(input.medications.map((resource) => `Medication/${resource.id}`));
  const requestSet = new Set(input.medicationRequests.map((resource) => `MedicationRequest/${resource.id}`));

  for (const request of input.medicationRequests) {
    if (request.subject.reference !== input.patientRef) {
      issues.push({ field: `MedicationRequest/${request.id}.subject`, message: 'MedicationRequest must point to the active patient.' });
    }

    const medicationRef = request.medicationReference?.reference;
    if (!medicationRef || !medicationSet.has(medicationRef)) {
      issues.push({ field: `MedicationRequest/${request.id}.medicationReference`, message: 'MedicationRequest must point to an existing Medication.' });
    }
  }

  for (const administration of input.administrations) {
    if (administration.subject.reference !== input.patientRef) {
      issues.push({ field: `MedicationAdministration/${administration.id}.subject`, message: 'MedicationAdministration must point to the active patient.' });
    }

    const requestRef = administration.request?.reference;
    if (!requestRef || !requestSet.has(requestRef)) {
      issues.push({ field: `MedicationAdministration/${administration.id}.request`, message: 'MedicationAdministration must point to an existing MedicationRequest.' });
    }

    const medicationRef = administration.medicationReference?.reference;
    if (!medicationRef || !medicationSet.has(medicationRef)) {
      issues.push({ field: `MedicationAdministration/${administration.id}.medicationReference`, message: 'MedicationAdministration must point to an existing Medication.' });
    }
  }

  return { ok: issues.length === 0, issues };
};
