import { OvokFetchError, ovokFetch } from '@/lib/ovok-fetch';
import type {
  ConsentResource,
  FhirBundle,
  MedicationAdministrationResource,
  MedicationRequestResource,
  MedicationResource,
  PatientResource,
  RelatedPersonResource,
} from './types';

type OperationOutcomeIssue = {
  diagnostics?: string;
  details?: { text?: string };
};

type OperationOutcomeBody = {
  resourceType?: string;
  issue?: OperationOutcomeIssue[];
};

export class FhirRepositoryError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly operationOutcomeText?: string,
    public readonly causeBody?: unknown,
  ) {
    super(operationOutcomeText ? `${status.toString()} ${operationOutcomeText}` : `FHIR request failed: ${status.toString()} ${path}`);
    this.name = 'FhirRepositoryError';
  }
}

const parseOperationOutcomeText = (body: unknown): string | undefined => {
  if (!body || typeof body !== 'object') return undefined;
  const outcome = body as OperationOutcomeBody;
  if (outcome.resourceType !== 'OperationOutcome') return undefined;
  const pieces = (outcome.issue ?? [])
    .map((item) => item.diagnostics ?? item.details?.text)
    .filter((item): item is string => Boolean(item && item.trim()));
  if (pieces.length === 0) return undefined;
  return pieces.join(' · ');
};

const isRetryable = (status: number): boolean => status === 429 || status >= 500;

const withRetry = async <T>(run: () => Promise<T>): Promise<T> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < 2) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!(error instanceof OvokFetchError) || !isRetryable(error.status) || attempt === 1) {
        break;
      }
    }
    attempt += 1;
  }

  throw lastError;
};

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  try {
    return await withRetry(() => ovokFetch<T>(path, options));
  } catch (error) {
    if (error instanceof OvokFetchError) {
      throw new FhirRepositoryError(error.status, path, parseOperationOutcomeText(error.body), error.body);
    }
    throw error;
  }
};

export const FhirRepository = {
  searchPatients: (query = '_count=50&_sort=-_lastUpdated') =>
    request<FhirBundle<PatientResource>>(`/fhir/R4/Patient?${query}`),

  readPatient: (id: string) => request<PatientResource>(`/fhir/R4/Patient/${id}`),

  createPatient: (resource: Omit<PatientResource, 'id'>) =>
    request<PatientResource>('/fhir/R4/Patient', { method: 'POST', body: JSON.stringify(resource) }),

  updatePatient: (id: string, resource: PatientResource) =>
    request<PatientResource>(`/fhir/R4/Patient/${id}`, { method: 'PUT', body: JSON.stringify(resource) }),

  searchMedications: (query = '_count=200&_sort=-_lastUpdated') =>
    request<FhirBundle<MedicationResource>>(`/fhir/R4/Medication?${query}`),

  createMedication: (resource: Omit<MedicationResource, 'id'>) =>
    request<MedicationResource>('/fhir/R4/Medication', { method: 'POST', body: JSON.stringify(resource) }),

  updateMedication: (id: string, resource: MedicationResource) =>
    request<MedicationResource>(`/fhir/R4/Medication/${id}`, { method: 'PUT', body: JSON.stringify(resource) }),

  searchMedicationRequests: (query: string) =>
    request<FhirBundle<MedicationRequestResource>>(`/fhir/R4/MedicationRequest?${query}`),

  createMedicationRequest: (resource: Omit<MedicationRequestResource, 'id'>) =>
    request<MedicationRequestResource>('/fhir/R4/MedicationRequest', { method: 'POST', body: JSON.stringify(resource) }),

  updateMedicationRequest: (id: string, resource: MedicationRequestResource) =>
    request<MedicationRequestResource>(`/fhir/R4/MedicationRequest/${id}`, {
      method: 'PUT',
      body: JSON.stringify(resource),
    }),

  searchMedicationAdministrations: (query: string) =>
    request<FhirBundle<MedicationAdministrationResource>>(`/fhir/R4/MedicationAdministration?${query}`),

  createMedicationAdministration: (resource: Omit<MedicationAdministrationResource, 'id'>) =>
    request<MedicationAdministrationResource>('/fhir/R4/MedicationAdministration', {
      method: 'POST',
      body: JSON.stringify(resource),
    }),

  deleteMedicationAdministration: (id: string) =>
    request<void>(`/fhir/R4/MedicationAdministration/${id}`, { method: 'DELETE' }),

  searchConsents: (query: string) => request<FhirBundle<ConsentResource>>(`/fhir/R4/Consent?${query}`),

  createConsent: (resource: ConsentResource) =>
    request<ConsentResource>('/fhir/R4/Consent', { method: 'POST', body: JSON.stringify(resource) }),

  updateConsent: (id: string, resource: ConsentResource) =>
    request<ConsentResource>(`/fhir/R4/Consent/${id}`, { method: 'PUT', body: JSON.stringify(resource) }),

  searchRelatedPeople: (query: string) => request<FhirBundle<RelatedPersonResource>>(`/fhir/R4/RelatedPerson?${query}`),

  createRelatedPerson: (resource: RelatedPersonResource) =>
    request<RelatedPersonResource>('/fhir/R4/RelatedPerson', { method: 'POST', body: JSON.stringify(resource) }),

  updateRelatedPerson: (id: string, resource: RelatedPersonResource) =>
    request<RelatedPersonResource>(`/fhir/R4/RelatedPerson/${id}`, {
      method: 'PUT',
      body: JSON.stringify(resource),
    }),
};
