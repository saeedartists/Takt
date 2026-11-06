import { describe, expect, it } from 'vitest';
import { runStructuredExtensionBackfill } from '../src/bots/backfill-structured-extensions.js';
import { TAKT_EXT } from '../src/domain/constants.js';
import { readAppearance, readPauseHistory } from '../src/domain/structured-extensions.js';
import type { MedicationRequestResource, MedicationResource } from '../src/domain/types.js';
import { createFakeFhir } from './fake-fhir.js';

const pauses = [{ start: '2026-11-01T08:00:00.000Z', end: '2026-11-03T08:00:00.000Z' }];
const pill = { shape: 'round', color: '#112233' };

const request = (
  id: string,
  extension: MedicationRequestResource['extension'],
): MedicationRequestResource => ({
  resourceType: 'MedicationRequest',
  id,
  status: 'active',
  subject: { reference: 'Patient/p-1' },
  medicationReference: { reference: 'Medication/med-1' },
  extension,
});

const legacyMed: MedicationResource = {
  resourceType: 'Medication',
  id: 'med-1',
  extension: [{ url: TAKT_EXT.appearance, valueString: JSON.stringify(pill) }],
};

const fixture = () =>
  createFakeFhir({
    Patient: [{ resourceType: 'Patient', id: 'p-1' }],
    MedicationRequest: [
      request('req-legacy', [{ url: TAKT_EXT.pauseHistory, valueString: JSON.stringify(pauses) }]),
      request('req-none', []),
    ],
    Medication: [legacyMed],
  });

describe('runStructuredExtensionBackfill (S-08)', () => {
  it('is a dry run by default', async () => {
    const fhir = fixture();
    const summary = await runStructuredExtensionBackfill(fhir);
    expect(summary).toMatchObject({ requestsUpdated: 1, medicationsUpdated: 1 });
    expect(fhir.updated).toHaveLength(0);
  });

  it('phase 1 adds the structured shape and keeps the legacy string', async () => {
    const fhir = fixture();
    await runStructuredExtensionBackfill(fhir, { dryRun: false });
    const [req, med] = fhir.updated as [MedicationRequestResource, MedicationResource];
    expect(readPauseHistory(req.extension)).toEqual(pauses);
    expect(req.extension?.some((x) => x.url === TAKT_EXT.pausePeriod)).toBe(true);
    expect(req.extension?.some((x) => x.url === TAKT_EXT.pauseHistory)).toBe(true);
    expect(readAppearance(med.extension)).toEqual(pill);
    expect(med.extension?.some((x) => x.url === TAKT_EXT.medicationAppearance)).toBe(true);
  });

  it('phase 2 (--drop-legacy) removes the legacy strings', async () => {
    const fhir = fixture();
    await runStructuredExtensionBackfill(fhir, { dryRun: false, dropLegacy: true });
    const [req, med] = fhir.updated as [MedicationRequestResource, MedicationResource];
    expect(req.extension?.some((x) => x.url === TAKT_EXT.pauseHistory)).toBe(false);
    expect(readPauseHistory(req.extension)).toEqual(pauses);
    expect(med.extension?.some((x) => x.url === TAKT_EXT.appearance)).toBe(false);
  });

  it('is idempotent: already-structured records are left alone', async () => {
    const fhir = fixture();
    await runStructuredExtensionBackfill(fhir, { dryRun: false });
    const second = createFakeFhir({
      Patient: [{ resourceType: 'Patient', id: 'p-1' }],
      MedicationRequest: [fhir.updated[0] as MedicationRequestResource],
      Medication: [fhir.updated[1] as MedicationResource],
    });
    const summary = await runStructuredExtensionBackfill(second, { dryRun: false });
    expect(summary).toMatchObject({ requestsUpdated: 0, medicationsUpdated: 0 });
    expect(second.updated).toHaveLength(0);
  });
});
