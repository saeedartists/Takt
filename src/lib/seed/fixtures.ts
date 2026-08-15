/*
 * Demo clinical fixtures for the in-memory FHIR store in
 * ../mock-server.ts. Active only when the scaffold's OVOK_MOCK env flag is set
 * (NEXT_PUBLIC_OVOK_MOCK on web, EXPO_PUBLIC_OVOK_MOCK on mobile).
 *
 * Why this exists: a generated app pointed at the live API with no
 * tenant credentials renders empty lists on every screen — the code
 * can be perfectly correct and the app still looks broken. These
 * fixtures make the first render show something real.
 *
 * Everything here is synthetic. Names are invented, MRNs are in the
 * documentation-reserved range, and the app shows a persistent
 * "Sample data" indicator whenever the mock is active so this can never be
 * mistaken for real PHI.
 *
 * Shapes are real FHIR R4 — real LOINC codes, real ValueSet bindings,
 * real reference formats ("Patient/pat-001"). An app written against
 * these fixtures works unchanged against a live tenant.
 */

export interface FhirResource {
  resourceType: string;
  id: string;
  meta?: { versionId?: string; lastUpdated?: string };
  [key: string]: unknown;
}

/** Stable "now" anchor so fixture dates are deterministic per boot. */
const NOW = new Date();

const isoDaysAgo = (days: number): string => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const meta = (daysAgo = 0): FhirResource['meta'] => ({
  versionId: '1',
  lastUpdated: isoDaysAgo(daysAgo),
});

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

export const PATIENTS: FhirResource[] = [
  {
    resourceType: 'Patient',
    id: 'pat-001',
    meta: meta(2),
    active: true,
    identifier: [
      {
        system: 'http://hospital.example.org/mrn',
        value: 'MRN-000199',
      },
    ],
    name: [{ use: 'official', family: 'Okonkwo', given: ['Amara'] }],
    telecom: [
      { system: 'email', value: 'amara.okonkwo@example.com', use: 'home' },
      { system: 'phone', value: '+1-555-0142', use: 'mobile' },
    ],
    gender: 'female',
    birthDate: '1971-04-18',
    address: [
      {
        use: 'home',
        line: ['418 Larkspur Way'],
        city: 'Portland',
        state: 'OR',
        postalCode: '97205',
        country: 'US',
      },
    ],
  },
  {
    resourceType: 'Patient',
    id: 'pat-002',
    meta: meta(5),
    active: true,
    identifier: [
      { system: 'http://hospital.example.org/mrn', value: 'MRN-000204' },
    ],
    name: [{ use: 'official', family: 'Halvorsen', given: ['Jonas', 'Erik'] }],
    telecom: [{ system: 'email', value: 'j.halvorsen@example.com', use: 'home' }],
    gender: 'male',
    birthDate: '1958-11-02',
    address: [
      {
        use: 'home',
        line: ['22 Fernhill Road'],
        city: 'Portland',
        state: 'OR',
        postalCode: '97210',
        country: 'US',
      },
    ],
  },
  {
    resourceType: 'Patient',
    id: 'pat-003',
    meta: meta(1),
    active: true,
    identifier: [
      { system: 'http://hospital.example.org/mrn', value: 'MRN-000211' },
    ],
    name: [{ use: 'official', family: 'Reyes', given: ['Camila'] }],
    telecom: [{ system: 'phone', value: '+1-555-0188', use: 'mobile' }],
    gender: 'female',
    birthDate: '1993-07-30',
    address: [
      {
        use: 'home',
        line: ['1907 Sellwood Blvd', 'Apt 4'],
        city: 'Portland',
        state: 'OR',
        postalCode: '97202',
        country: 'US',
      },
    ],
  },
  {
    resourceType: 'Patient',
    id: 'pat-004',
    meta: meta(11),
    active: true,
    identifier: [
      { system: 'http://hospital.example.org/mrn', value: 'MRN-000218' },
    ],
    name: [{ use: 'official', family: 'Novak', given: ['Petra'] }],
    telecom: [{ system: 'email', value: 'petra.novak@example.com', use: 'work' }],
    gender: 'female',
    birthDate: '1984-02-14',
  },
  {
    resourceType: 'Patient',
    id: 'pat-005',
    meta: meta(23),
    active: false,
    identifier: [
      { system: 'http://hospital.example.org/mrn', value: 'MRN-000225' },
    ],
    name: [{ use: 'official', family: 'Baptiste', given: ['Marcus'] }],
    gender: 'male',
    birthDate: '1966-09-09',
  },
];

/* ------------------------------------------------------------------ */
/* Practitioners                                                       */
/* ------------------------------------------------------------------ */

export const PRACTITIONERS: FhirResource[] = [
  {
    resourceType: 'Practitioner',
    id: 'prac-001',
    meta: meta(30),
    active: true,
    name: [
      { use: 'official', family: 'Whitfield', given: ['Elena'], prefix: ['Dr.'] },
    ],
    telecom: [{ system: 'email', value: 'e.whitfield@example.org', use: 'work' }],
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
              code: 'MD',
              display: 'Doctor of Medicine',
            },
          ],
          text: 'Internal Medicine',
        },
      },
    ],
  },
  {
    resourceType: 'Practitioner',
    id: 'prac-002',
    meta: meta(30),
    active: true,
    name: [{ use: 'official', family: 'Adeyemi', given: ['Tunde'], prefix: ['Dr.'] }],
    telecom: [{ system: 'email', value: 't.adeyemi@example.org', use: 'work' }],
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
              code: 'MD',
              display: 'Doctor of Medicine',
            },
          ],
          text: 'Cardiology',
        },
      },
    ],
  },
  {
    resourceType: 'Practitioner',
    id: 'prac-003',
    meta: meta(30),
    active: true,
    name: [{ use: 'official', family: 'Lindqvist', given: ['Sara'] }],
    telecom: [{ system: 'email', value: 's.lindqvist@example.org', use: 'work' }],
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
              code: 'RN',
              display: 'Registered Nurse',
            },
          ],
          text: 'Nurse Practitioner',
        },
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Observations — 6-month blood-pressure series with a real trend      */
/* ------------------------------------------------------------------ */

/*
 * pat-001 is the "rich" patient: a 12-reading blood-pressure series
 * over ~6 months trending DOWN (hypertension responding to treatment).
 * Charts built against this show a visible, explainable slope instead
 * of noise.
 *
 * LOINC 85354-9 = "Blood pressure panel with all children optional",
 * with component codes 8480-6 (systolic) and 8462-4 (diastolic). This
 * is the standard shape a real Ovok/Medplum tenant returns.
 */
const BP_SERIES: ReadonlyArray<{ daysAgo: number; systolic: number; diastolic: number }> = [
  { daysAgo: 182, systolic: 158, diastolic: 96 },
  { daysAgo: 168, systolic: 155, diastolic: 95 },
  { daysAgo: 154, systolic: 152, diastolic: 94 },
  { daysAgo: 140, systolic: 149, diastolic: 92 },
  { daysAgo: 119, systolic: 147, diastolic: 91 },
  { daysAgo: 98, systolic: 143, diastolic: 89 },
  { daysAgo: 77, systolic: 140, diastolic: 88 },
  { daysAgo: 63, systolic: 137, diastolic: 86 },
  { daysAgo: 49, systolic: 134, diastolic: 85 },
  { daysAgo: 35, systolic: 131, diastolic: 83 },
  { daysAgo: 21, systolic: 129, diastolic: 82 },
  { daysAgo: 7, systolic: 126, diastolic: 80 },
];

const bpObservation = (
  entry: { daysAgo: number; systolic: number; diastolic: number },
  index: number,
): FhirResource => ({
  resourceType: 'Observation',
  id: `obs-bp-${String(index + 1).padStart(3, '0')}`,
  meta: meta(entry.daysAgo),
  status: 'final',
  category: [
    {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs',
        },
      ],
    },
  ],
  code: {
    coding: [
      {
        system: 'http://loinc.org',
        code: '85354-9',
        display: 'Blood pressure panel with all children optional',
      },
    ],
    text: 'Blood pressure',
  },
  subject: { reference: 'Patient/pat-001', display: 'Amara Okonkwo' },
  performer: [{ reference: 'Practitioner/prac-002', display: 'Dr. Tunde Adeyemi' }],
  effectiveDateTime: isoDaysAgo(entry.daysAgo),
  component: [
    {
      code: {
        coding: [
          { system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' },
        ],
      },
      valueQuantity: {
        value: entry.systolic,
        unit: 'mmHg',
        system: 'http://unitsofmeasure.org',
        code: 'mm[Hg]',
      },
    },
    {
      code: {
        coding: [
          { system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' },
        ],
      },
      valueQuantity: {
        value: entry.diastolic,
        unit: 'mmHg',
        system: 'http://unitsofmeasure.org',
        code: 'mm[Hg]',
      },
    },
  ],
});

/** A couple of single-value observations so non-panel code paths have data too. */
const OTHER_OBSERVATIONS: FhirResource[] = [
  {
    resourceType: 'Observation',
    id: 'obs-wt-001',
    meta: meta(7),
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          },
        ],
      },
    ],
    code: {
      coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body weight' }],
      text: 'Body weight',
    },
    subject: { reference: 'Patient/pat-001', display: 'Amara Okonkwo' },
    effectiveDateTime: isoDaysAgo(7),
    valueQuantity: {
      value: 71.2,
      unit: 'kg',
      system: 'http://unitsofmeasure.org',
      code: 'kg',
    },
  },
  {
    resourceType: 'Observation',
    id: 'obs-hr-001',
    meta: meta(5),
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          },
        ],
      },
    ],
    code: {
      coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }],
      text: 'Heart rate',
    },
    subject: { reference: 'Patient/pat-002', display: 'Jonas Halvorsen' },
    effectiveDateTime: isoDaysAgo(5),
    valueQuantity: {
      value: 74,
      unit: '/min',
      system: 'http://unitsofmeasure.org',
      code: '/min',
    },
  },
];

export const OBSERVATIONS: FhirResource[] = [
  ...BP_SERIES.map(bpObservation),
  ...OTHER_OBSERVATIONS,
];

/* ------------------------------------------------------------------ */
/* Questionnaire — multi-item with an enableWhen branch                */
/* ------------------------------------------------------------------ */

export const QUESTIONNAIRES: FhirResource[] = [
  {
    resourceType: 'Questionnaire',
    id: 'quest-intake-001',
    meta: meta(45),
    url: 'http://example.org/Questionnaire/pre-visit-intake',
    version: '1.0.0',
    name: 'PreVisitIntake',
    title: 'Pre-visit intake',
    status: 'active',
    subjectType: ['Patient'],
    date: isoDaysAgo(45),
    description:
      'Short intake form completed by the patient before a scheduled visit.',
    item: [
      {
        linkId: 'reason',
        text: 'What is the main reason for your visit today?',
        type: 'text',
        required: true,
      },
      {
        linkId: 'pain-present',
        text: 'Are you currently experiencing pain?',
        type: 'boolean',
        required: true,
      },
      {
        // enableWhen branch — only shown when pain-present is true.
        // Exercising a conditional item means the generated form
        // renderer has to handle branching on the first build.
        linkId: 'pain-score',
        text: 'On a scale of 0-10, how would you rate the pain?',
        type: 'integer',
        required: true,
        enableWhen: [
          { question: 'pain-present', operator: '=', answerBoolean: true },
        ],
      },
      {
        linkId: 'pain-location',
        text: 'Where is the pain located?',
        type: 'string',
        enableWhen: [
          { question: 'pain-present', operator: '=', answerBoolean: true },
        ],
      },
      {
        linkId: 'medications',
        text: 'Have you started any new medications since your last visit?',
        type: 'boolean',
      },
      {
        linkId: 'preferred-contact',
        text: 'Preferred contact method for follow-up',
        type: 'choice',
        answerOption: [
          { valueString: 'Email' },
          { valueString: 'Phone' },
          { valueString: 'Text message' },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Seed table                                                          */
/* ------------------------------------------------------------------ */

/**
 * Everything the mock FHIR store is preloaded with, keyed by
 * resourceType. `mock-server.ts` deep-clones this at install time so
 * runtime writes never mutate the fixtures.
 */
export const SEED: Record<string, FhirResource[]> = {
  Patient: PATIENTS,
  Practitioner: PRACTITIONERS,
  Observation: OBSERVATIONS,
  Questionnaire: QUESTIONNAIRES,
};
