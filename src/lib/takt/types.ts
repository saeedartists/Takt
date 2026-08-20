export type FhirBundle<T> = {
  total: number;
  entry?: Array<{ resource: T }>;
};

export type FhirReference = {
  reference: string;
  display?: string;
};

export type FhirExtension = {
  url?: string;
  valueString?: string;
  valueInteger?: number;
  valueDateTime?: string;
};

export type WeekdayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type PatientResource = {
  resourceType: 'Patient';
  id: string;
  name?: Array<{ given?: string[]; family?: string }>;
  birthDate?: string;
  gender?: string;
};

export type MedicationResource = {
  resourceType: 'Medication';
  id: string;
  status?: string;
  code?: { text?: string };
  form?: { text?: string };
  extension?: FhirExtension[];
};

export type MedicationRequestResource = {
  resourceType: 'MedicationRequest';
  id: string;
  status: 'active' | 'on-hold' | 'stopped' | string;
  intent: string;
  subject: FhirReference;
  medicationReference?: FhirReference;
  authoredOn?: string;
  extension?: FhirExtension[];
  dosageInstruction?: Array<{
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: string;
        dayOfWeek?: WeekdayCode[];
        timeOfDay?: string[];
      };
    };
  }>;
  dispenseRequest?: {
    quantity?: {
      value?: number;
      unit?: string;
    };
  };
};

export type MedicationAdministrationResource = {
  resourceType: 'MedicationAdministration';
  id: string;
  status: 'completed' | 'not-done' | string;
  subject: FhirReference;
  medicationReference?: FhirReference;
  request?: FhirReference;
  effectiveDateTime?: string;
  statusReason?: Array<{
    coding?: Array<{ code?: string; display?: string; system?: string }>;
    text?: string;
  }>;
  extension?: FhirExtension[];
};

export type ConsentResource = {
  resourceType: 'Consent';
  id?: string;
  status: string;
  patient: FhirReference;
  dateTime: string;
  scope: { coding: Array<{ system: string; code: string }> };
  category: Array<{ coding: Array<{ system: string; code: string; display?: string }> }>;
  policyRule?: {
    text?: string;
  };
};

export type DoseState = 'scheduled' | 'due' | 'taken' | 'skipped' | 'missed';

export type MedicationCadence = 'daily' | 'weekdays' | 'custom';

export type PausePeriod = {
  start: string;
  end?: string;
};

export type MedicationPlan = {
  request: MedicationRequestResource;
  medication: MedicationResource | null;
  label: string;
  form: string;
  strength: string;
  times: string[];
  cadence: MedicationCadence;
  dayOfWeek: WeekdayCode[];
  supplyCount?: number;
  createdAt?: string;
  archivedAt?: string;
  pauseHistory: PausePeriod[];
};

export type DoseOccurrence = {
  id: string;
  requestId: string;
  medicationRef?: string;
  label: string;
  strength?: string;
  scheduledAt: Date;
  state: DoseState;
  eventId?: string;
  eventTimestamp?: string;
};
