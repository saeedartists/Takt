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
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
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
        /** Course bounds: `start` anchors an every-N-days schedule, `end` is the last day. */
        boundsPeriod?: { start?: string; end?: string };
      };
    };
    /** True for "as needed" medications: no schedule, logged when taken. */
    asNeededBoolean?: boolean;
    /** Free-text intake note, e.g. "with a full glass of water". */
    patientInstruction?: string;
    additionalInstruction?: Array<{ coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string }>;
    maxDosePerPeriod?: { numerator?: { value?: number }; denominator?: { value?: number; unit?: string } };
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
  status: 'active' | 'inactive' | 'draft' | string;
  patient: FhirReference;
  dateTime: string;
  scope: { coding: Array<{ system: string; code: string }> };
  category: Array<{ coding: Array<{ system: string; code: string; display?: string }> }>;
  policyRule?: {
    text?: string;
  };
  extension?: FhirExtension[];
  provision?: {
    type?: 'permit' | 'deny' | string;
    actor?: Array<{
      role?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
      reference?: FhirReference;
    }>;
  };
};

export type RelatedPersonResource = {
  resourceType: 'RelatedPerson';
  id?: string;
  active?: boolean;
  patient: FhirReference;
  relationship?: Array<{
    coding?: Array<{ system?: string; code?: string; display?: string }>;
  }>;
  name?: Array<{
    use?: 'official' | 'usual' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden' | string;
    family?: string;
    given?: string[];
  }>;
  telecom?: Array<{
    system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other' | string;
    value?: string;
    use?: 'home' | 'work' | 'temp' | 'old' | 'mobile' | string;
  }>;
  extension?: FhirExtension[];
};

export type FamilyGrantStatus = 'granted' | 'revoked';

export type FamilySharingGrant = {
  id: string;
  patientRef: string;
  relatedPersonRef: string;
  relatedPersonLabel: string;
  relationshipCode?: string;
  /** Invitation address; the relative's account is matched on it. */
  email?: string;
  /** Set once the relative accepted on their own account. */
  linkedAccountRef?: string;
  acceptedAt?: string;
  grantedAt: string;
  revokedAt?: string;
  status: FamilyGrantStatus;
  consent: ConsentResource;
};

export type DoseState = 'scheduled' | 'due' | 'taken' | 'skipped' | 'missed';

/** What the user said when skipping; a record, not an interpretation. */
export type SkipReason = 'forgot' | 'side-effects' | 'ran-out' | 'not-needed' | 'other';

export type MedicationCadence = 'daily' | 'weekdays' | 'custom' | 'interval' | 'as-needed';

/** How a dose is taken; a record the patient chose, never drug information. */
export type IntakeInstruction = 'with-food' | 'empty-stomach' | 'before-bed';

export type MedicationShape = 'round' | 'oval' | 'capsule' | 'drops' | 'inhaler' | 'injection' | 'other';

/** What the tablet looks like, so the row icon matches the real thing. */
export type MedicationAppearance = { shape: MedicationShape; color: string };

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
  /** Every N days from `intervalStart` (cadence 'interval'). */
  intervalDays?: number;
  /** YYYY-MM-DD */
  intervalStart?: string;
  /** YYYY-MM-DD; the last day of a course. Doses stop after it and the plan archives itself. */
  endDate?: string;
  asNeeded?: boolean;
  maxPerDay?: number;
  instruction?: IntakeInstruction;
  instructionNote?: string;
  appearance?: MedicationAppearance;
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
  /** User-reported reason on a skipped dose, when one was given. */
  reasonCode?: SkipReason;
  instruction?: IntakeInstruction;
  instructionNote?: string;
};
