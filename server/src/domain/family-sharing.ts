import { DateTime } from 'luxon';
import {
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  FAMILY_SHARE_BLOCKED_CAPABILITIES,
  FAMILY_SHARE_POLICY,
  FAMILY_SHARE_PUSH_IDENTIFIER_SYSTEM,
  FAMILY_SHARE_UNCONFIRMED_HOURS,
  TAKT_EXT,
} from './constants.js';
import { normalizeReference, sameReference } from './references.js';
import { hoursBetween, isQuietHours, parseInstant, toIsoInstant } from './time.js';
import type {
  ConsentResource,
  DoseOccurrence,
  FamilyShareTodayDose,
  FamilyShareTodayView,
  PatientResource,
  RelatedPersonResource,
} from './types.js';

export const isFamilyShareConsent = (consent: ConsentResource): boolean =>
  consent.policyRule?.text === FAMILY_SHARE_POLICY;

export const relatedPersonLinkedAccount = (relatedPerson: RelatedPersonResource): string | undefined =>
  relatedPerson.extension?.find((extension) => extension.url === TAKT_EXT.familyShareLinkedAccount)?.valueString;

export const relatedPersonEmail = (relatedPerson: RelatedPersonResource): string | undefined =>
  relatedPerson.telecom?.find((telecom) => telecom.system === 'email')?.value?.trim().toLowerCase();

export const hasActiveFamilyShareConsent = (
  consent: ConsentResource,
  relatedPerson: RelatedPersonResource,
): boolean => {
  if (consent.status !== 'active' || !isFamilyShareConsent(consent)) return false;
  if (consent.provision?.type === 'deny') return false;
  if (!relatedPerson.id || relatedPerson.active === false) return false;
  if (!relatedPersonLinkedAccount(relatedPerson)) return false;
  if (!sameReference(relatedPerson.patient?.reference, consent.patient?.reference)) return false;
  const actorRef = consent.provision?.actor?.[0]?.reference?.reference;
  return sameReference(actorRef, `RelatedPerson/${relatedPerson.id}`);
};

export const isActiveFamilyShare = (
  consent: ConsentResource,
  relatedPerson: RelatedPersonResource,
  relativePatientRef: string,
): boolean =>
  hasActiveFamilyShareConsent(consent, relatedPerson) &&
  sameReference(relatedPersonLinkedAccount(relatedPerson), relativePatientRef);

export const patientLabel = (patient: PatientResource): string => {
  const name = patient.name?.[0];
  const given = name?.given?.join(' ') ?? '';
  const family = name?.family ?? '';
  const label = `${given} ${family}`.trim();
  return label || 'Patient';
};

export const familySharePushKey = (requestId: string, scheduledAt: string, relativePatientRef: string): string =>
  `${requestId}~${scheduledAt}~${normalizeReference(relativePatientRef) ?? relativePatientRef}`;

export const familySharePushIdentifier = (
  requestId: string,
  scheduledAt: string,
  relativePatientRef: string,
): { system: string; value: string } => ({
  system: FAMILY_SHARE_PUSH_IDENTIFIER_SYSTEM,
  value: familySharePushKey(requestId, scheduledAt, relativePatientRef),
});

export const buildFamilyShareTodayView = (
  patient: PatientResource,
  patientRef: string,
  doses: DoseOccurrence[],
  now: DateTime,
  zone: string,
): FamilyShareTodayView => {
  const todayDoses: FamilyShareTodayDose[] = doses.map((dose) => {
    const scheduled = parseInstant(dose.scheduledAt, zone);
    const unconfirmedForHours =
      scheduled && (dose.state === 'due' || dose.state === 'missed')
        ? Math.max(0, Number(hoursBetween(scheduled, now).toFixed(1)))
        : 0;
    return {
      requestId: dose.requestId,
      label: dose.label,
      scheduledAt: dose.scheduledAt,
      status: dose.state,
      unconfirmedForHours,
    };
  });

  return {
    patientRef,
    patientLabel: patientLabel(patient),
    generatedAt: toIsoInstant(now),
    doses: todayDoses,
    blocked: [...FAMILY_SHARE_BLOCKED_CAPABILITIES],
  };
};

export type UnconfirmedOptions = {
  unconfirmedHours?: number;
  maxAgeHours?: number;
  zone?: string;
  quietHours?: {
    startHour?: number;
    endHour?: number;
  };
};

export const selectUnconfirmedDoses = (
  doses: DoseOccurrence[],
  now: DateTime,
  options: UnconfirmedOptions = {},
): DoseOccurrence[] => {
  const zone = options.zone ?? 'UTC';
  const unconfirmedHours = options.unconfirmedHours ?? FAMILY_SHARE_UNCONFIRMED_HOURS;
  const maxAgeHours = options.maxAgeHours ?? 26;

  if (
    options.quietHours &&
    isQuietHours(
      now,
      zone,
      options.quietHours.startHour ?? DEFAULT_QUIET_HOURS_START,
      options.quietHours.endHour ?? DEFAULT_QUIET_HOURS_END,
    )
  ) {
    return [];
  }

  return doses.filter((dose) => {
    if (dose.state !== 'due' && dose.state !== 'missed') return false;
    const scheduled = parseInstant(dose.scheduledAt, zone);
    if (!scheduled) return false;
    const age = hoursBetween(scheduled, now);
    return age >= unconfirmedHours && age <= maxAgeHours;
  });
};

export const isFamilySharePushIdentifier = (value: {
  system?: string;
  value?: string;
}): boolean => value.system === FAMILY_SHARE_PUSH_IDENTIFIER_SYSTEM && Boolean(value.value);
