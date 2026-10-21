import { describe, expect, it } from 'vitest';

import {
  isValidReference,
  validateConsentResource,
  validateMedicationAdministrationResource,
  validateMedicationRequestResource,
} from './fhir-validation';
import type {
  ConsentResource,
  MedicationAdministrationResource,
  MedicationRequestResource,
} from './types';

const SAMPLE_ISO = '2026-01-01T08:00:00.000Z';

const validRequest = (): MedicationRequestResource => ({
  resourceType: 'MedicationRequest',
  id: 'req-1',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/p1' },
  medicationReference: { reference: 'Medication/m1' },
  dosageInstruction: [{ timing: { repeat: { timeOfDay: ['08:00', '18:00'] } } }],
});

const validAdministration = (): MedicationAdministrationResource => ({
  resourceType: 'MedicationAdministration',
  id: 'adm-1',
  status: 'completed',
  subject: { reference: 'Patient/p1' },
  request: { reference: 'MedicationRequest/req-1' },
  medicationReference: { reference: 'Medication/m1' },
  effectiveDateTime: SAMPLE_ISO,
});

const validConsent = (): ConsentResource => ({
  resourceType: 'Consent',
  id: 'consent-1',
  status: 'active',
  patient: { reference: 'Patient/p1' },
  dateTime: SAMPLE_ISO,
  scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' }] },
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes', code: 'research' }] }],
});

describe('isValidReference', () => {
  it('accepts ResourceType/id form only', () => {
    expect(isValidReference('Patient/abc')).toBe(true);
    expect(isValidReference('MedicationRequest/123')).toBe(true);
    expect(isValidReference('Patient')).toBe(false);
    expect(isValidReference('/abc')).toBe(false);
    expect(isValidReference('Patient/')).toBe(false);
    expect(isValidReference(undefined)).toBe(false);
  });
});

describe('validateMedicationRequestResource', () => {
  it('accepts a complete request', () => {
    const result = validateMedicationRequestResource(validRequest());
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('flags bad references', () => {
    const resource = validRequest();
    resource.subject = { reference: 'p1' };
    const result = validateMedicationRequestResource(resource);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.field)).toContain('subject');
  });

  it('flags missing or malformed dose times', () => {
    const noTimes = validRequest();
    noTimes.dosageInstruction = [];
    const malformed = validRequest();
    malformed.dosageInstruction = [{ timing: { repeat: { timeOfDay: ['8:0'] } } }];
    expect(validateMedicationRequestResource(noTimes).issues.map((i) => i.field)).toContain(
      'dosageInstruction[0].timing.repeat.timeOfDay',
    );
    expect(validateMedicationRequestResource(malformed).issues.map((i) => i.field)).toContain('timeOfDay');
  });
});

describe('validateMedicationAdministrationResource', () => {
  it('accepts a completed administration', () => {
    expect(validateMedicationAdministrationResource(validAdministration()).ok).toBe(true);
  });

  it('flags non-ISO timestamps and unknown statuses', () => {
    const badTime = validAdministration();
    badTime.effectiveDateTime = 'yesterday';
    const badStatus = validAdministration();
    badStatus.status = 'in-progress';
    expect(validateMedicationAdministrationResource(badTime).issues.map((i) => i.field)).toContain(
      'effectiveDateTime',
    );
    expect(validateMedicationAdministrationResource(badStatus).issues.map((i) => i.field)).toContain('status');
  });

  it('flags a missing request reference', () => {
    const resource = validAdministration();
    delete resource.request;
    const result = validateMedicationAdministrationResource(resource);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.field)).toContain('request');
  });
});

describe('validateConsentResource', () => {
  it('accepts a well-formed consent', () => {
    expect(validateConsentResource(validConsent()).ok).toBe(true);
  });

  it('flags unknown scope/category codes', () => {
    const resource = validConsent();
    resource.scope = { coding: [{ system: 'x', code: '' }] };
    resource.category = [];
    const result = validateConsentResource(resource);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.field)).toContain('scope.coding[0].code');
    expect(result.issues.map((i) => i.field)).toContain('category[0].coding[0].code');
  });
});
