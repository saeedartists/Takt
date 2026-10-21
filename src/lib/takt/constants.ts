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
  /** On the RelatedPerson: the relative's own Patient account once they accept the invitation. */
  familyShareLinkedAccount: 'https://actimi.com/fhir/takt/family-share/linked-account',
  familyShareAcceptedAt: 'https://actimi.com/fhir/takt/family-share/accepted-at',
  /** On the MedicationRequest: YYYY-MM-DD the regimen becomes active. */
  startDate: 'https://actimi.com/fhir/takt/start-date',
  /** On the MedicationRequest: per-intake dosage quantity (e.g. 2 tablets). */
  dosageQuantity: 'https://actimi.com/fhir/takt/dosage-quantity',
  /** Coding system for the user-reported reason on a skipped dose. */
  skipReason: 'https://actimi.com/fhir/takt/skip-reason',
  /** Identifier system on a recorded dose: one stable identifier per (plan, scheduled time, action). */
  doseEvent: 'https://actimi.com/fhir/takt/dose-event',
  /**
   * On a recorded dose: the plan slot it belongs to, frozen at record time as
   * `${requestId}|${local date}|${wall time}`. Devices in other timezones (or after
   * a DST shift) key the same dose by their own local clock, so the schedule engine
   * matches events by this slot first and falls back to the local key for legacy events.
   */
  planSlot: 'https://actimi.com/fhir/takt/plan-slot',
  /** Identifier system on the Consent resource: one per (patient, status). */
  consent: 'https://actimi.com/fhir/takt/consent',
  /** Coding system for the intake instruction chosen on a medication. */
  intakeInstruction: 'https://actimi.com/fhir/takt/intake-instruction',
  /** On the Medication: JSON { shape, color } for the row icon. */
  appearance: 'https://actimi.com/fhir/takt/appearance',
} as const;

/** On a Medication: the owning patient id, so patient-scoped FHIR policies can match it. */
export const PATIENT_SCOPE_SYSTEM = 'https://actimi.com/fhir/takt/patient-scope';

export const TAKT_CONSENT_VERSION = 'takt-consent-v1';
export const CONSENT_STORAGE_KEY = `takt:consent:${TAKT_CONSENT_VERSION}`;
export const PRIMARY_PATIENT_STORAGE_KEY = 'takt:primary-patient-id:v1';
export const REMINDER_PREFS_STORAGE_KEY = 'takt:reminder-preferences:v1';
/** Set once the first-run tour is finished or skipped, so consent only routes into it the first time. */
export const TOUR_SEEN_STORAGE_KEY = 'takt:tour-seen:v1';

export const DEFAULT_GRACE_HOURS = 4;
export const DEFAULT_SNOOZE_MINUTES = 15;
