export const TAKT_EXT = {
  strength: 'https://actimi.com/fhir/takt/strength',
  scheduledTime: 'https://actimi.com/fhir/takt/scheduled-time',
} as const;

export const TAKT_CONSENT_VERSION = 'takt-consent-v1';
export const CONSENT_STORAGE_KEY = `takt:consent:${TAKT_CONSENT_VERSION}`;

export const DEFAULT_GRACE_HOURS = 4;
