import { describe, expect, it } from 'vitest';
import {
  normalizeReference,
  parseReference,
  referenceId,
  sameReference,
} from '../src/domain/references.js';

describe('FHIR references', () => {
  it('parses relative, absolute, and versioned references', () => {
    expect(parseReference('Patient/abc')).toEqual({ type: 'Patient', id: 'abc' });
    expect(parseReference('https://api.ovok.com/fhir/R4/Patient/abc')).toEqual({
      type: 'Patient',
      id: 'abc',
    });
    expect(parseReference('Patient/abc/_history/7')).toEqual({ type: 'Patient', id: 'abc' });
  });

  it('normalizes references and compares them safely', () => {
    expect(normalizeReference('https://host/fhir/R4/Patient/abc')).toBe('Patient/abc');
    expect(referenceId('Medication/med-1')).toBe('med-1');
    expect(sameReference('Patient/abc', 'https://host/fhir/R4/Patient/abc')).toBe(true);
    expect(sameReference('Patient/abc', 'Patient/def')).toBe(false);
  });

  it('does not invent identifiers for URNs or empty values', () => {
    expect(parseReference('urn:uuid:1234')).toBeUndefined();
    expect(parseReference('')).toBeUndefined();
    expect(parseReference(undefined)).toBeUndefined();
  });
});
