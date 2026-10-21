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
  familyShareLinkedAccount: 'https://actimi.com/fhir/takt/family-share/linked-account',
  familyShareAcceptedAt: 'https://actimi.com/fhir/takt/family-share/accepted-at',
  startDate: 'https://actimi.com/fhir/takt/start-date',
  dosageQuantity: 'https://actimi.com/fhir/takt/dosage-quantity',
  skipReason: 'https://actimi.com/fhir/takt/skip-reason',
  intakeInstruction: 'https://actimi.com/fhir/takt/intake-instruction',
  appearance: 'https://actimi.com/fhir/takt/appearance',
  patientTimezone: 'https://actimi.com/fhir/takt/patient-timezone',
} as const;

export const FAMILY_SHARE_POLICY = 'takt-family-sharing-v1';

export const DEFAULT_GRACE_HOURS = 4;

export const FAMILY_SHARE_UNCONFIRMED_HOURS = 2;

export const PATIENT_SCOPE_SYSTEM = 'https://actimi.com/fhir/takt/patient-scope';

export const EXPO_PUSH_TOKEN_SYSTEM = 'https://actimi.com/fhir/takt/push/expo';

export const FAMILY_SHARE_PUSH_IDENTIFIER_SYSTEM = 'https://actimi.com/fhir/takt/family-share/push';
export const FAMILY_SHARE_CLAIM_IDENTIFIER_SYSTEM = 'https://actimi.com/fhir/takt/family-share/claim';

export const FAMILY_SHARE_PUSH_CHANNEL_ID = 'family-share';

export const DEFAULT_QUIET_HOURS_START = 21;

export const DEFAULT_QUIET_HOURS_END = 8;

export const FAMILY_SHARE_BLOCKED_CAPABILITIES = ['edit-regimen', 'view-diary', 'export-doctor-report'] as const;
