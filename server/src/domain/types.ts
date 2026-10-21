export type WeekdayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type MedicationCadence = 'daily' | 'weekdays' | 'custom' | 'interval' | 'as-needed';

export type DoseState = 'scheduled' | 'due' | 'taken' | 'skipped' | 'missed';

export type SkipReason = 'forgot' | 'side-effects' | 'ran-out' | 'not-needed' | 'other';

export type FhirReference = {
  reference?: string;
  display?: string;
};

export type FhirExtension = {
  url: string;
  valueString?: string;
  valueDateTime?: string;
  valueInteger?: number;
  valueBoolean?: boolean;
  valueCode?: string;
  valueCoding?: {
    system?: string;
    code?: string;
    display?: string;
  };
  valueReference?: FhirReference;
};

export type FhirResource = {
  resourceType: string;
  id?: string;
  meta?: {
    lastUpdated?: string;
    versionId?: string;
  };
  extension?: FhirExtension[];
};

export type FhirBundle<T> = {
  resourceType: 'Bundle';
  type?: string;
  total?: number;
  link?: {
    relation?: string;
    url?: string;
  }[];
  entry?: {
    resource: T;
    fullUrl?: string;
    search?: { mode?: string };
  }[];
};

export type PatientResource = FhirResource & {
  resourceType: 'Patient';
  name?: {
    use?: string;
    given?: string[];
    family?: string;
  }[];
  telecom?: {
    system?: string;
    value?: string;
    use?: string;
  }[];
  birthDate?: string;
  gender?: string;
};

export type MedicationResource = FhirResource & {
  resourceType: 'Medication';
  status?: string;
  code?: { text?: string };
  form?: { text?: string };
  identifier?: {
    system?: string;
    value?: string;
  }[];
};

export type MedicationRequestResource = FhirResource & {
  resourceType: 'MedicationRequest';
  status: 'active' | 'on-hold' | 'stopped' | string;
  intent?: string;
  subject?: FhirReference;
  medicationReference?: FhirReference;
  authoredOn?: string;
  dosageInstruction?: {
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: string;
        dayOfWeek?: WeekdayCode[];
        timeOfDay?: string[];
        boundsPeriod?: {
          start?: string;
          end?: string;
        };
      };
    };
    asNeededBoolean?: boolean;
    patientInstruction?: string;
    additionalInstruction?: {
      coding?: {
        system?: string;
        code?: string;
        display?: string;
      }[];
      text?: string;
    }[];
    maxDosePerPeriod?: {
      numerator?: { value?: number };
      denominator?: { value?: number; unit?: string };
    };
  }[];
  dispenseRequest?: {
    quantity?: {
      value?: number;
      unit?: string;
    };
  };
};

export type MedicationAdministrationResource = FhirResource & {
  resourceType: 'MedicationAdministration';
  status: 'completed' | 'not-done' | string;
  subject?: FhirReference;
  medicationReference?: FhirReference;
  request?: FhirReference;
  effectiveDateTime?: string;
  statusReason?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
    text?: string;
  }[];
};

export type ConsentResource = FhirResource & {
  resourceType: 'Consent';
  status: 'active' | 'inactive' | 'draft' | string;
  patient?: FhirReference;
  dateTime?: string;
  scope?: {
    coding?: {
      system?: string;
      code?: string;
    }[];
  };
  category?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
  }[];
  policyRule?: {
    text?: string;
  };
  provision?: {
    type?: 'permit' | 'deny' | string;
    actor?: {
      role?: {
        coding?: {
          system?: string;
          code?: string;
          display?: string;
        }[];
      };
      reference?: FhirReference;
    }[];
  };
};

export type RelatedPersonResource = FhirResource & {
  resourceType: 'RelatedPerson';
  active?: boolean;
  patient?: FhirReference;
  relationship?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
  }[];
  name?: {
    use?: string;
    family?: string;
    given?: string[];
  }[];
  telecom?: {
    system?: string;
    value?: string;
    use?: string;
  }[];
};

export type DeviceResource = FhirResource & {
  resourceType: 'Device';
  status?: 'active' | 'inactive' | 'entered-in-error' | string;
  patient?: FhirReference;
  type?: { text?: string };
  identifier?: {
    system?: string;
    value?: string;
  }[];
};

export type CommunicationResource = FhirResource & {
  resourceType: 'Communication';
  status?: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown' | string;
  sent?: string;
  subject?: FhirReference;
  recipient?: FhirReference[];
  identifier?: {
    system?: string;
    value?: string;
  }[];
  payload?: {
    contentString?: string;
    contentReference?: FhirReference;
  }[];
};

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
  intervalDays?: number;
  intervalStart?: string;
  startDate?: string;
  endDate?: string;
  asNeeded: boolean;
  maxPerDay?: number;
  createdAt?: string;
  archivedAt?: string;
  pauseHistory: PausePeriod[];
  status: string;
};

export type DoseOccurrence = {
  id: string;
  requestId: string;
  medicationRef?: string;
  label: string;
  strength?: string;
  scheduledAt: string;
  state: DoseState;
  eventId?: string;
  reasonCode?: SkipReason;
};

export type FamilyShareTodayDose = {
  requestId: string;
  label: string;
  scheduledAt: string;
  status: DoseState;
  unconfirmedForHours: number;
};

export type FamilyShareTodayView = {
  patientRef: string;
  patientLabel: string;
  generatedAt: string;
  doses: FamilyShareTodayDose[];
  blocked: string[];
};

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: null;
  priority: 'default' | 'normal' | 'high';
  channelId: string;
  interruptionLevel: 'passive' | 'active' | 'timeSensitive' | 'critical';
  ttl?: number;
  data: {
    type: 'family-share-unconfirmed';
    patientRef: string;
  };
};

export type ExpoPushResult = {
  ok: boolean;
  invalidToken?: boolean;
  error?: string;
};
