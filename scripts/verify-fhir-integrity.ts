import {
  validateConsentResource,
  validateMedicationAdministrationResource,
  validateMedicationGraphIntegrity,
  validateMedicationRequestResource,
  validateMedicationResource,
  validatePatientResource,
  validateRelatedPersonResource,
} from '../src/lib/takt/fhir-validation';
import { buildFamilyShareConsent, buildFamilyShareRevokeConsent } from '../src/lib/takt/family-sharing';
import { TAKT_EXT } from '../src/lib/takt/constants';

const patient = {
  resourceType: 'Patient' as const,
  id: 'p-1',
  name: [{ family: 'Meyer', given: ['Lea'] }],
};

const medication = {
  resourceType: 'Medication' as const,
  id: 'm-1',
  status: 'active',
  code: { text: 'Lisinopril' },
};

const request = {
  resourceType: 'MedicationRequest' as const,
  id: 'mr-1',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/p-1' },
  medicationReference: { reference: 'Medication/m-1' },
  dosageInstruction: [{ timing: { repeat: { timeOfDay: ['08:00'] } } }],
};

const administration = {
  resourceType: 'MedicationAdministration' as const,
  id: 'ma-1',
  status: 'completed',
  subject: { reference: 'Patient/p-1' },
  request: { reference: 'MedicationRequest/mr-1' },
  medicationReference: { reference: 'Medication/m-1' },
  effectiveDateTime: '2026-08-27T10:15:00.000Z',
};

const relatedPerson = {
  resourceType: 'RelatedPerson' as const,
  id: 'rel-1',
  patient: { reference: 'Patient/p-1' },
  relationship: [{ coding: [{ code: 'FAMMEMB' }] }],
  name: [{ family: 'Meyer', given: ['Anna'] }],
  active: true,
};

const familyConsent = buildFamilyShareConsent({
  patientRef: 'Patient/p-1',
  relatedPersonRef: 'RelatedPerson/rel-1',
  relationshipCode: 'FAMMEMB',
  grantedByRef: { reference: 'Patient/p-1' },
  grantedAt: '2026-08-27T09:00:00.000Z',
});

const revokedConsent = buildFamilyShareRevokeConsent({
  consent: { ...familyConsent, id: 'c-1' },
  revokedByRef: { reference: 'Patient/p-1' },
  revokedAt: '2026-08-27T10:00:00.000Z',
});

const checks: Array<[string, { ok: boolean; issues: Array<{ field: string; message: string }> }]> = [
  ['patient-shape', validatePatientResource(patient)],
  ['medication-shape', validateMedicationResource(medication)],
  ['request-shape', validateMedicationRequestResource(request)],
  ['administration-shape', validateMedicationAdministrationResource(administration)],
  ['related-person-shape', validateRelatedPersonResource(relatedPerson)],
  ['consent-shape', validateConsentResource(familyConsent)],
  [
    'graph-integrity',
    validateMedicationGraphIntegrity({
      patientRef: 'Patient/p-1',
      medications: [medication],
      medicationRequests: [request],
      administrations: [administration],
    }),
  ],
  [
    'family-revoke-marker',
    {
      ok: Boolean(revokedConsent.extension?.some((item) => item.url === TAKT_EXT.familyShareRevokedAt)),
      issues: [] as Array<{ field: string; message: string }>,
    },
  ],
];

let pass = true;
for (const [id, result] of checks) {
  if (!result.ok) {
    pass = false;
    // eslint-disable-next-line no-console
    console.log(`FAIL  ${id}`);
    for (const issue of result.issues) {
      // eslint-disable-next-line no-console
      console.log(`      ${issue.field}: ${issue.message}`);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log(`PASS  ${id}`);
  }
}

if (!pass) process.exitCode = 1;
