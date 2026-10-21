import { DateTime } from 'luxon';
import { mapWithConcurrency } from '../concurrency.js';
import { isFamilyShareConsent } from '../domain/family-sharing.js';
import { normalizeReference } from '../domain/references.js';
import type { ConsentResource } from '../domain/types.js';
import { FhirHttpError, type FhirClient } from '../fhir.js';
import { searchAll } from '../fhir-queries.js';
import {
  runFamilyShareUnconfirmed,
  type FamilyShareUnconfirmedOptions,
  type FamilyShareUnconfirmedSummary,
  type SendPush,
} from './family-share-unconfirmed.js';

export type FamilyShareScanOptions = FamilyShareUnconfirmedOptions & {
  concurrency?: number;
  maxPatients?: number;
  offset?: number;
  consentPageSize?: number;
};

export type FamilyShareScanDeps = {
  fhir: FhirClient;
  sendPush?: SendPush;
};

export type FamilyShareScanResult =
  | { patientRef: string; summary: FamilyShareUnconfirmedSummary }
  | { patientRef: string; error: string };

export type FamilyShareScanSummary = {
  patientCount: number;
  results: FamilyShareScanResult[];
  nextOffset?: number;
  blockers: string[];
};

export const runFamilyShareUnconfirmedScan = async (
  deps: FamilyShareScanDeps,
  options: FamilyShareScanOptions = {},
): Promise<FamilyShareScanSummary> => {
  const now = options.now instanceof DateTime ? options.now : DateTime.fromJSDate(options.now ?? new Date());
  const maxPatients = Math.max(1, Math.min(options.maxPatients ?? 500, 5000));
  const offset = Math.max(0, options.offset ?? 0);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 50));
  const consentPageSize = Math.max(1, Math.min(options.consentPageSize ?? 200, 1000));
  const consents = await searchAll<ConsentResource>(
    deps.fhir,
    'Consent',
    { status: 'active', _sort: '-date' },
    consentPageSize,
  );

  const patientRefs = [
    ...new Set(
      consents
        .filter((consent) => consent.status === 'active' && isFamilyShareConsent(consent))
        .map((consent) => normalizeReference(consent.patient?.reference))
        .filter((ref): ref is string => Boolean(ref)),
    ),
  ];

  const selected = patientRefs.slice(offset, offset + maxPatients);
  const results = await mapWithConcurrency(selected, concurrency, async (patientRef) => {
    try {
      const summary = await runFamilyShareUnconfirmed({ patientRef }, deps, {
        ...options,
        now,
      });
      return { patientRef, summary };
    } catch (error) {
      return {
        patientRef,
        error:
          error instanceof FhirHttpError
            ? `fhir-http-${error.status.toString()}`
            : 'family-share-scan-failed',
      };
    }
  });

  return {
    patientCount: selected.length,
    results,
    ...(offset + selected.length < patientRefs.length
      ? { nextOffset: offset + selected.length }
      : {}),
    blockers: patientRefs.length === 0 ? ['no-active-family-shares'] : [],
  };
};
