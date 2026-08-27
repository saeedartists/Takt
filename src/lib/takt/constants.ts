export const TAKT_EXT = {
  strength: 'https://actimi.com/fhir/takt/strength',
  scheduledTime: 'https://actimi.com/fhir/takt/scheduled-time',
  requestCreatedAt: 'https://actimi.com/fhir/takt/request-created-at',
  pauseHistory: 'https://actimi.com/fhir/takt/pause-history',
  archivedAt: 'https://actimi.com/fhir/takt/archived-at',
  familyShareGrant: 'https://actimi.com/fhir/takt/family-share/grant',
  familyShareGrantedAt: 'https://actimi.com/fhir/takt/family-share/granted-at',
  familyShareGrantedBy: 'https://actimi.com/fhir/takt/family-share/granted-by',
  familyShareRevokedAt: 'https://actimi.com/fhir/takt/family-share/revoked-at',
  familyShareRevokedBy: 'https://actimi.com/fhir/takt/family-share/revoked-by',
  familyShareRelationshipCode: 'https://actimi.com/fhir/takt/family-share/relationship-code',
} as const;

export const TAKT_CONSENT_VERSION = 'takt-consent-v1';
export const CONSENT_STORAGE_KEY = `takt:consent:${TAKT_CONSENT_VERSION}`;
export const PRIMARY_PATIENT_STORAGE_KEY = 'takt:primary-patient-id:v1';
export const REMINDER_PREFS_STORAGE_KEY = 'takt:reminder-preferences:v1';

export const DEFAULT_GRACE_HOURS = 4;
export const DEFAULT_SNOOZE_MINUTES = 15;
