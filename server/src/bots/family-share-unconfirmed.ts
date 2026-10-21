import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import {
  familySharePushIdentifier,
  hasActiveFamilyShareConsent,
  isFamilyShareConsent,
  relatedPersonLinkedAccount,
  selectUnconfirmedDoses,
} from '../domain/family-sharing.js';
import { buildFamilySharePushMessage, isExpoPushToken } from '../domain/push.js';
import { normalizeReference, referenceId } from '../domain/references.js';
import { buildDoseOccurrencesForDays, patientTimezone } from '../domain/schedule.js';
import {
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  EXPO_PUSH_TOKEN_SYSTEM,
  FAMILY_SHARE_CLAIM_IDENTIFIER_SYSTEM,
  FAMILY_SHARE_UNCONFIRMED_HOURS,
} from '../domain/constants.js';
import { startOfDay } from '../domain/time.js';
import type {
  CommunicationResource,
  DeviceResource,
  ExpoPushMessage,
  ExpoPushResult,
  RelatedPersonResource,
} from '../domain/types.js';
import type { FhirClient } from '../fhir.js';
import {
  loadActiveDevices,
  loadAdministrationsSince,
  loadFamilyShareConsents,
  loadPatient,
  loadPatientPlans,
  loadRecentCommunications,
  loadRelatedPeopleByIds,
} from '../fhir-queries.js';

export type FamilyShareUnconfirmedInput = {
  patientRef: string;
};

export type FamilyShareUnconfirmedOptions = {
  now?: Date | DateTime;
  unconfirmedHours?: number;
  maxAgeHours?: number;
  defaultTimezone?: string;
  quietHours?: {
    startHour: number;
    endHour: number;
  };
  channelId?: string;
  claimTtlMinutes?: number;
  dryRun?: boolean;
};

export type SendPush = (messages: ExpoPushMessage[]) => Promise<ExpoPushResult[]>;

export type FamilyShareUnconfirmedDeps = {
  fhir: FhirClient;
  sendPush?: SendPush;
};

export type FamilyShareUnconfirmedSummary = {
  patientRef: string;
  unconfirmedDoseCount: number;
  recipientCount: number;
  sentCount: number;
  wouldSendCount: number;
  skippedCount: number;
  failedCount: number;
  writeFailureCount: number;
  blockers: string[];
};

type RelativePushTarget = {
  tokens: string[];
  devicesByToken: Map<string, DeviceResource[]>;
};

const pushTarget = (devices: DeviceResource[]): RelativePushTarget => {
  const devicesByToken = new Map<string, DeviceResource[]>();
  for (const device of devices) {
    for (const identifier of device.identifier ?? []) {
      if (
        identifier.system === EXPO_PUSH_TOKEN_SYSTEM &&
        identifier.value &&
        isExpoPushToken(identifier.value)
      ) {
        const matches = devicesByToken.get(identifier.value) ?? [];
        matches.push(device);
        devicesByToken.set(identifier.value, matches);
      }
    }
  }
  return { tokens: [...devicesByToken.keys()], devicesByToken };
};

const communicationKey = (identifier: { system?: string; value?: string }): string | undefined =>
  identifier.system && identifier.value ? `${identifier.system}|${identifier.value}` : undefined;

const activeFamilyShareRecipients = async (
  fhir: FhirClient,
  patientRef: string,
): Promise<RelatedPersonResource[]> => {
  const consents = (await loadFamilyShareConsents(fhir, patientRef)).filter(
    (consent) => consent.status === 'active' && isFamilyShareConsent(consent),
  );
  const actorIds = consents
    .map((consent) => referenceId(consent.provision?.actor?.[0]?.reference?.reference))
    .filter((id): id is string => Boolean(id));
  const relatedPeople = await loadRelatedPeopleByIds(fhir, actorIds);
  const byRef = new Map(
    relatedPeople.map((relatedPerson) => [
      normalizeReference(`RelatedPerson/${relatedPerson.id ?? ''}`),
      relatedPerson,
    ]),
  );

  const recipients = new Map<string, RelatedPersonResource>();
  for (const consent of consents) {
    const actorRef = normalizeReference(consent.provision?.actor?.[0]?.reference?.reference);
    const relatedPerson = actorRef ? byRef.get(actorRef) : undefined;
    if (
      relatedPerson?.id &&
      hasActiveFamilyShareConsent(consent, relatedPerson) &&
      !recipients.has(relatedPerson.id)
    ) {
      recipients.set(relatedPerson.id, relatedPerson);
    }
  }
  return [...recipients.values()];
};

const communicationFor = (
  patientRef: string,
  identifier: { system: string; value: string },
  recipientRef: string,
  now: DateTime,
  claimId: string,
  status: 'in-progress' | 'completed' = 'in-progress',
): CommunicationResource => ({
  resourceType: 'Communication',
  status,
  subject: { reference: patientRef },
  sent: now.toUTC().toISO() ?? undefined,
  recipient: [{ reference: recipientRef }],
  identifier: [identifier, { system: FAMILY_SHARE_CLAIM_IDENTIFIER_SYSTEM, value: claimId }],
  payload: [
    {
      contentString: 'Family-share unconfirmed dose notification sent.',
    },
  ],
});

const claimIdentifierValue = (communication: CommunicationResource): string | undefined =>
  communication.identifier?.find(
    (identifier) => identifier.system === FAMILY_SHARE_CLAIM_IDENTIFIER_SYSTEM,
  )?.value;

const claimIsStale = (
  communication: CommunicationResource,
  now: DateTime,
  claimTtlMinutes: number,
): boolean => {
  const sent = communication.sent ? DateTime.fromISO(communication.sent, { setZone: true }) : null;
  if (!sent?.isValid) return true;
  return now.diff(sent, 'minutes').minutes > claimTtlMinutes;
};

export const runFamilyShareUnconfirmed = async (
  input: FamilyShareUnconfirmedInput,
  deps: FamilyShareUnconfirmedDeps,
  options: FamilyShareUnconfirmedOptions = {},
): Promise<FamilyShareUnconfirmedSummary> => {
  const now = options.now instanceof DateTime ? options.now : DateTime.fromJSDate(options.now ?? new Date());
  const patient = await loadPatient(deps.fhir, input.patientRef);
  const zone = patientTimezone(patient, options.defaultTimezone);
  const plans = await loadPatientPlans(deps.fhir, input.patientRef, zone);
  const since = now.minus({ days: 2 }).toUTC().toISO() ?? '';
  const administrations = await loadAdministrationsSince(deps.fhir, input.patientRef, since);
  const today = startOfDay(now, zone);
  const days = [today.minus({ days: 1 }), today];
  const doses = buildDoseOccurrencesForDays(plans, administrations, days, now, zone);
  const unconfirmed = selectUnconfirmedDoses(doses, now, {
    zone,
    unconfirmedHours: options.unconfirmedHours ?? FAMILY_SHARE_UNCONFIRMED_HOURS,
    maxAgeHours: options.maxAgeHours ?? 26,
    quietHours: options.quietHours ?? {
      startHour: DEFAULT_QUIET_HOURS_START,
      endHour: DEFAULT_QUIET_HOURS_END,
    },
  });

  const summary: FamilyShareUnconfirmedSummary = {
    patientRef: input.patientRef,
    unconfirmedDoseCount: unconfirmed.length,
    recipientCount: 0,
    sentCount: 0,
    wouldSendCount: 0,
    skippedCount: 0,
    failedCount: 0,
    writeFailureCount: 0,
    blockers: [],
  };

  if (unconfirmed.length === 0) return summary;

  const relatedPeople = (await activeFamilyShareRecipients(deps.fhir, input.patientRef)).filter(
    (relatedPerson) => Boolean(relatedPersonLinkedAccount(relatedPerson)),
  );
  summary.recipientCount = relatedPeople.length;
  if (relatedPeople.length === 0) {
    summary.blockers.push('no-family-share-recipients');
    return summary;
  }

  // The push belongs to the relative's own Patient account, not the sharing patient's.
  const tokensByRelative = new Map<string, RelativePushTarget>();
  for (const relatedPerson of relatedPeople) {
    const relativePatientRef = normalizeReference(relatedPersonLinkedAccount(relatedPerson));
    if (!relativePatientRef || tokensByRelative.has(relativePatientRef)) continue;
    try {
      const devices = await loadActiveDevices(deps.fhir, relativePatientRef);
      const target = pushTarget(devices);
      if (target.tokens.length > 0) tokensByRelative.set(relativePatientRef, target);
    } catch {
      summary.blockers.push('device-lookup-failed');
    }
  }
  if (tokensByRelative.size === 0) {
    summary.blockers.push('no-push-token');
    return summary;
  }

  const sendPush = deps.sendPush;
  if (!sendPush) {
    summary.blockers.push('push-sender-not-configured');
    return summary;
  }

  const claimTtlMinutes = Math.max(1, options.claimTtlMinutes ?? 15);
  const existingCommunications = options.dryRun
    ? await loadRecentCommunications(deps.fhir, input.patientRef, since)
    : [];
  const sentIdentifiers = new Set(
    existingCommunications.flatMap((communication) =>
      (communication.identifier ?? [])
        .map((identifier) => communicationKey(identifier))
        .filter((key): key is string => Boolean(key)),
    ),
  );

  for (const dose of unconfirmed) {
    for (const relatedPerson of relatedPeople) {
      const recipientRef = `RelatedPerson/${relatedPerson.id ?? ''}`;
      const relativePatientRef = normalizeReference(relatedPersonLinkedAccount(relatedPerson));
      if (!relativePatientRef) continue;
      const target = tokensByRelative.get(relativePatientRef);
      if (!target) continue;
      const tokens = target.tokens;
      const identifier = familySharePushIdentifier(dose.requestId, dose.scheduledAt, relativePatientRef);
      const key = communicationKey(identifier);

      if (options.dryRun) {
        if (key && sentIdentifiers.has(key)) {
          summary.skippedCount += 1;
          continue;
        }
        summary.wouldSendCount += 1;
        if (key) sentIdentifiers.add(key);
        continue;
      }

      const claimId = randomUUID();
      let claim: CommunicationResource;
      try {
        claim = await deps.fhir.create(
          communicationFor(input.patientRef, identifier, recipientRef, now, claimId),
          {
            ifNoneExist: `identifier=${identifier.system}|${identifier.value}`,
          },
        );
      } catch {
        summary.writeFailureCount += 1;
        continue;
      }

      if (claimIdentifierValue(claim) !== claimId) {
        if (claim.status !== 'in-progress' || !claim.id || !claimIsStale(claim, now, claimTtlMinutes)) {
          summary.skippedCount += 1;
          continue;
        }
        try {
          claim = await deps.fhir.update({
            ...claim,
            status: 'in-progress',
            sent: now.toUTC().toISO() ?? undefined,
            identifier: [
              ...(claim.identifier ?? []).filter(
                (candidate) => candidate.system !== FAMILY_SHARE_CLAIM_IDENTIFIER_SYSTEM,
              ),
              { system: FAMILY_SHARE_CLAIM_IDENTIFIER_SYSTEM, value: claimId },
            ],
          });
        } catch {
          summary.writeFailureCount += 1;
          continue;
        }
      }

      if (!claim.id) {
        summary.writeFailureCount += 1;
        continue;
      }

      const messages = tokens.map((token) =>
        buildFamilySharePushMessage(token, input.patientRef, options.channelId),
      );
      const results = await sendPush(messages);
      const invalidDevices = new Map<string, DeviceResource>();
      results.forEach((result, index) => {
        if (!result.invalidToken) return;
        for (const device of target.devicesByToken.get(tokens[index] ?? '') ?? []) {
          if (device.id) invalidDevices.set(device.id, device);
        }
      });
      for (const device of invalidDevices.values()) {
        try {
          await deps.fhir.update({ ...device, status: 'inactive' });
        } catch {
          summary.writeFailureCount += 1;
        }
      }

      const delivered = results.some((result) => result.ok);
      if (!delivered) {
        summary.failedCount += 1;
        try {
          await deps.fhir.delete(`/fhir/R4/Communication/${claim.id}`);
        } catch {
          summary.writeFailureCount += 1;
        }
        continue;
      }

      summary.sentCount += 1;
      try {
        await deps.fhir.update({ ...claim, status: 'completed', sent: now.toUTC().toISO() ?? undefined });
      } catch {
        summary.writeFailureCount += 1;
      }
    }
  }

  if (summary.writeFailureCount > 0) summary.blockers.push('communication-write-failed');

  return summary;
};
