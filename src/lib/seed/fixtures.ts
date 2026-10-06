/*
 * Local FHIR store fixtures.
 * Clean slate for production on-device client storage.
 */

export interface FhirResource {
  resourceType: string;
  id: string;
  meta?: { versionId?: string; lastUpdated?: string };
  [key: string]: unknown;
}

export const SEED: Record<string, FhirResource[]> = {};
