import 'dotenv/config';
import { randomBytes, createHash } from 'node:crypto';
import { DateTime } from 'luxon';
import { loadConfig } from '../src/config.js';
import { createOvokFhirClient } from '../src/ovok.js';
import { runFamilyShareToday } from '../src/bots/family-share-today.js';
import { runFamilyShareUnconfirmed } from '../src/bots/family-share-unconfirmed.js';
import { runFamilyShareUnconfirmedScan } from '../src/bots/family-share-scan.js';
import { runMedicationScopeBackfill } from '../src/bots/backfill-medication-scope.js';
import { runErasure } from '../src/bots/erasure.js';
import {
  EXPO_PUSH_TOKEN_SYSTEM,
  FAMILY_SHARE_POLICY,
  PATIENT_SCOPE_SYSTEM,
  TAKT_EXT,
} from '../src/domain/constants.js';
import { localScheduledKey, toIsoInstant } from '../src/domain/time.js';
import type {
  ConsentResource,
  DeviceResource,
  ExpoPushMessage,
  MedicationAdministrationResource,
  MedicationRequestResource,
  MedicationResource,
  PatientResource,
  RelatedPersonResource,
} from '../src/domain/types.js';

/* App-only extension systems (mirror src/lib/takt/constants.ts). */
const DOSE_EVENT_SYSTEM = 'https://actimi.com/fhir/takt/dose-event';
const PLAN_SLOT_SYSTEM = 'https://actimi.com/fhir/takt/plan-slot';

const EMAIL = process.env.TAKT_VERIFY_EMAIL ?? '';
const PASSWORD = process.env.TAKT_VERIFY_PASSWORD ?? '';
const API_URL = process.env.OVOK_API_URL ?? 'https://api.sandbox.ovok.com';
const TENANT = process.env.OVOK_TENANT_CODE ?? '';
const ZONE = 'Europe/Berlin';
const RUN = `smoke-${Date.now()}`;
const RELATIVE_EMAIL = `takt-smoke-${RUN}@example.com`;

let passed = 0;
let failed = 0;
const failures: string[] = [];
const ok = (label: string, detail = ''): void => {
  passed += 1;
  console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
};
const bad = (label: string, detail = ''): void => {
  failed += 1;
  failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
};
const expect = (condition: boolean, label: string, detail = ''): void => {
  if (condition) ok(label, detail);
  else bad(label, detail);
};

type Created = { resourceType: string; id: string };
const created: Created[] = [];
const track = <T extends { resourceType: string; id?: string }>(resource: T): T => {
  if (resource.id) created.push({ resourceType: resource.resourceType, id: resource.id });
  return resource;
};

type SmokePatient = PatientResource & { active?: boolean };
type SmokeAdministration = MedicationAdministrationResource & {
  identifier?: { system?: string; value?: string }[];
};

const main = async (): Promise<void> => {
  console.log(`\nTakt server-bot smoke → ${API_URL} (tenant ${TENANT})\n`);
  if (!EMAIL || !PASSWORD) throw new Error('Set TAKT_VERIFY_EMAIL / TAKT_VERIFY_PASSWORD (a Practitioner account).');

  /* --- 0. PKCE login → static-token FHIR client ---------------------- */
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const loginStart = await fetch(`${API_URL}/auth/tenant/Practitioner/login/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, codeChallenge: challenge, codeChallengeMethod: 'S256' }),
  });
  const startBody = (await loginStart.json()) as {
    sessionCode?: string;
    profiles?: { tenantCode?: string }[];
    message?: string;
  };
  if (!loginStart.ok || !startBody.sessionCode) throw new Error(`login start failed: ${startBody.message ?? String(loginStart.status)}`);
  const tenantCode =
    startBody.profiles?.find((profile) => profile.tenantCode === TENANT)?.tenantCode ?? startBody.profiles?.[0]?.tenantCode ?? TENANT;
  const tokenExchange = await fetch(`${API_URL}/auth/tenant/Practitioner/login/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionCode: startBody.sessionCode, codeVerifier: verifier, tenantCode }),
  });
  const tokenBody = (await tokenExchange.json()) as { accessToken?: string; message?: string };
  if (!tokenExchange.ok || !tokenBody.accessToken) throw new Error(`token exchange failed: ${tokenBody.message ?? String(tokenExchange.status)}`);
  ok('PKCE login (Practitioner)', `tenant ${tenantCode}`);

  const baseConfig = loadConfig();
  const config = { ...baseConfig, OVOK_ACCESS_TOKEN: tokenBody.accessToken };
  const fhir = createOvokFhirClient(config);

  const now = DateTime.now().setZone(ZONE).startOf('minute'); // zero ms: atClockTime also zeroes them
  const staleSlot = now.minus({ hours: 3 }); // unconfirmed window: 2h … 26h, within 4h grace → 'due'
  const freshSlot = now.minus({ hours: 1 });
  const staleTime = staleSlot.toFormat('HH:mm:00');
  const freshTime = freshSlot.toFormat('HH:mm:00');

  let patientAId: string | undefined;
  const sentMessages: ExpoPushMessage[] = [];

  try {
    /* --- 1. Patient A — every field the bots read -------------------- */
    const patientA: SmokePatient = track(
      await fhir.create<SmokePatient>({
        resourceType: 'Patient',
        active: true,
        name: [{ use: 'official', given: ['Ada'], family: 'TaktSmoke' }],
        telecom: [{ system: 'email', value: `ada-${RUN}@example.com`, use: 'home' }],
        birthDate: '1958-04-12',
        gender: 'female',
        extension: [{ url: TAKT_EXT.patientTimezone, valueString: ZONE }],
      }),
    );
    patientAId = patientA.id;
    expect(Boolean(patientAId), 'create Patient A (name/email/birthDate/gender/timezone)', patientAId);

    /* --- 2. Medication — label/form/strength/appearance --------------- */
    const medication: MedicationResource = track(
      await fhir.create<MedicationResource>({
        resourceType: 'Medication',
        status: 'active',
        code: { text: 'Metformin 500mg' },
        form: { text: 'Tablet' },
        extension: [
          { url: TAKT_EXT.strength, valueString: '500 mg' },
          { url: TAKT_EXT.appearance, valueString: JSON.stringify({ color: 'white', shape: 'round' }) },
        ],
      }),
    );
    expect(Boolean(medication.id), 'create Medication (code/form/strength/appearance)', medication.id);

    /* --- 3. MedicationRequests — daily / paused / as-needed ----------- */
    const dailyRequest: MedicationRequestResource = track(
      await fhir.create<MedicationRequestResource>({
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        authoredOn: toIsoInstant(staleSlot),
        subject: { reference: `Patient/${patientA.id}` },
        medicationReference: { reference: `Medication/${medication.id}`, display: 'Metformin 500mg' },
        dosageInstruction: [
          {
            timing: {
              repeat: {
                frequency: 1,
                period: 1,
                periodUnit: 'd',
                dayOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                timeOfDay: [staleTime, freshTime],
              },
            },
            asNeededBoolean: false,
            patientInstruction: 'Take with food',
            additionalInstruction: [{ coding: [{ system: TAKT_EXT.intakeInstruction, code: 'after-meal' }] }],
          },
        ],
        dispenseRequest: { quantity: { value: 60, unit: 'tablets' } },
        extension: [
          { url: TAKT_EXT.startDate, valueString: now.toFormat('yyyy-MM-dd') },
          { url: TAKT_EXT.requestCreatedAt, valueDateTime: toIsoInstant(staleSlot) },
          { url: TAKT_EXT.dosageQuantity, valueString: '1 tablet' },
        ],
      }),
    );
    expect(Boolean(dailyRequest.id), 'create MedicationRequest (daily, timing/instructions/dispense/extensions)', dailyRequest.id);

    const pausedRequest: MedicationRequestResource = track(
      await fhir.create<MedicationRequestResource>({
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        authoredOn: toIsoInstant(staleSlot),
        subject: { reference: `Patient/${patientA.id}` },
        medicationReference: { reference: `Medication/${medication.id}` },
        dosageInstruction: [
          {
            timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd', timeOfDay: [staleTime] } },
            asNeededBoolean: false,
          },
        ],
        extension: [
          { url: TAKT_EXT.startDate, valueString: now.toFormat('yyyy-MM-dd') },
          { url: TAKT_EXT.requestCreatedAt, valueDateTime: toIsoInstant(staleSlot) },
          { url: TAKT_EXT.pauseHistory, valueString: JSON.stringify([{ start: toIsoInstant(staleSlot.minus({ hours: 1 })) }]) },
        ],
      }),
    );
    expect(Boolean(pausedRequest.id), 'create MedicationRequest (paused via pauseHistory)', pausedRequest.id);

    const asNeededRequest: MedicationRequestResource = track(
      await fhir.create<MedicationRequestResource>({
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        authoredOn: toIsoInstant(staleSlot),
        subject: { reference: `Patient/${patientA.id}` },
        medicationReference: { reference: `Medication/${medication.id}` },
        dosageInstruction: [
          {
            asNeededBoolean: true,
            maxDosePerPeriod: { numerator: { value: 2 }, denominator: { value: 1, unit: 'd' } },
            patientInstruction: 'Only if needed',
          },
        ],
        extension: [
          { url: TAKT_EXT.startDate, valueString: now.toFormat('yyyy-MM-dd') },
          { url: TAKT_EXT.requestCreatedAt, valueDateTime: toIsoInstant(staleSlot) },
        ],
      }),
    );
    expect(Boolean(asNeededRequest.id), 'create MedicationRequest (as-needed, maxPerDay)', asNeededRequest.id);

    /* --- 4. MedicationAdministration — app's exact dose shape --------- */
    const doseEventId = `${dailyRequest.id}-${toIsoInstant(freshSlot)}-taken`;
    const administration: SmokeAdministration = track(
      await fhir.create<SmokeAdministration>({
        resourceType: 'MedicationAdministration',
        status: 'completed',
        subject: { reference: `Patient/${patientA.id}` },
        request: { reference: `MedicationRequest/${dailyRequest.id}` },
        medicationReference: { reference: `Medication/${medication.id}` },
        effectiveDateTime: toIsoInstant(freshSlot.plus({ minutes: 5 })),
        identifier: [{ system: DOSE_EVENT_SYSTEM, value: doseEventId }],
        extension: [
          { url: TAKT_EXT.scheduledTime, valueDateTime: toIsoInstant(freshSlot) },
          { url: PLAN_SLOT_SYSTEM, valueString: `${dailyRequest.id}|${localScheduledKey(freshSlot, ZONE)}` },
        ],
      }),
    );
    expect(Boolean(administration.id), 'create MedicationAdministration (taken, scheduledTime + planSlot)', administration.id);

    /* --- 5. Relative: Patient B + RelatedPerson + Device -------------- */
    const patientB: SmokePatient = track(
      await fhir.create<SmokePatient>({
        resourceType: 'Patient',
        active: true,
        name: [{ use: 'official', given: ['Ana'], family: 'RelativeSmoke' }],
        telecom: [{ system: 'email', value: RELATIVE_EMAIL }],
      }),
    );
    expect(Boolean(patientB.id), 'create Patient B (the relative)', patientB.id);

    const relatedPerson: RelatedPersonResource = track(
      await fhir.create<RelatedPersonResource>({
        resourceType: 'RelatedPerson',
        active: true,
        patient: { reference: `Patient/${patientA.id}` },
        name: [{ use: 'official', given: ['Ana'], family: 'RelativeSmoke' }],
        relationship: [
          { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: 'CHILD', display: 'relative' }] },
        ],
        telecom: [{ system: 'email', use: 'home', value: RELATIVE_EMAIL }],
        extension: [{ url: TAKT_EXT.familyShareLinkedAccount, valueString: `Patient/${patientB.id}` }],
      }),
    );
    expect(Boolean(relatedPerson.id), 'create RelatedPerson (email + linked account)', relatedPerson.id);

    const device: DeviceResource = track(
      await fhir.create<DeviceResource>({
        resourceType: 'Device',
        status: 'active',
        patient: { reference: `Patient/${patientB.id}` },
        type: { text: 'iPhone' },
        identifier: [{ system: EXPO_PUSH_TOKEN_SYSTEM, value: 'ExponentPushToken[takt-smoke-test-token]' }],
      }),
    );
    expect(Boolean(device.id), 'create Device (Expo push token on relative)', device.id);

    /* --- 6. Family-share Consent — app's exact shape ------------------ */
    const consent: ConsentResource = track(
      await fhir.create<ConsentResource>({
        resourceType: 'Consent',
        status: 'active',
        patient: { reference: `Patient/${patientA.id}` },
        dateTime: toIsoInstant(now),
        scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }] },
        category: [{ coding: [{ system: 'http://loinc.org', code: '59284-0', display: 'Patient Consent' }] }],
        policyRule: { text: FAMILY_SHARE_POLICY },
        provision: {
          type: 'permit',
          actor: [
            {
              role: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'IRCP', display: 'information recipient' }] },
              reference: { reference: `RelatedPerson/${relatedPerson.id}` },
            },
          ],
        },
        extension: [
          { url: TAKT_EXT.familyShareGrant, valueString: 'true' },
          { url: TAKT_EXT.familyShareGrantedAt, valueDateTime: toIsoInstant(now) },
          { url: TAKT_EXT.familyShareGrantedBy, valueString: `Patient/${patientA.id}` },
          { url: TAKT_EXT.familyShareRelationshipCode, valueString: 'CHILD' },
        ],
      }),
    );
    expect(Boolean(consent.id), 'create family-share Consent (policyRule + grant extensions)', consent.id);

    /* --- 7. Saved fields survive the round-trip (readPlan) ------------ */
    const { readPlan } = await import('../src/domain/schedule.js');
    const plan = readPlan(
      await fhir.read<MedicationRequestResource>(`/fhir/R4/MedicationRequest/${dailyRequest.id}`),
      await fhir.read<MedicationResource>(`/fhir/R4/Medication/${medication.id}`),
      ZONE,
    );
    expect(plan.label === 'Metformin 500mg' && plan.strength === '500 mg' && plan.form === 'Tablet', 'readPlan round-trip: label/strength/form', `${plan.label} / ${plan.strength} / ${plan.form}`);
    expect(
      plan.cadence === 'daily' && plan.times.length === 2 && plan.startDate === now.toFormat('yyyy-MM-dd'),
      'readPlan round-trip: cadence/times/startDate',
      `cadence=${plan.cadence} times=${plan.times.join(',')} start=${plan.startDate ?? ''}`,
    );

    /* --- 8. Bot: family-share-today ----------------------------------- */
    const today = await runFamilyShareToday(
      { relativePatientRef: `Patient/${patientB.id}`, relativeEmail: RELATIVE_EMAIL, patientRef: `Patient/${patientA.id}` },
      { fhir, defaultTimezone: config.TAKT_DEFAULT_TIMEZONE },
    );
    expect(today.shares.length === 1, 'bot family-share-today: 1 share');
    const view = today.shares[0];
    if (!view) throw new Error('family-share-today returned an empty share list');
    expect(view.patientLabel === 'Ada TaktSmoke', 'view.patientLabel from Patient.name', view.patientLabel);
    expect(view.blocked.length === 3, 'view.blocked capabilities', view.blocked.join(','));
    const takenDose = view.doses.find((dose) => dose.status === 'taken');
    expect(Boolean(takenDose), 'view has taken dose', takenDose ? `${takenDose.label} @${takenDose.scheduledAt}` : '');
    const pendingDose = view.doses.find((dose) => dose.status === 'due' || dose.status === 'missed');
    expect(Boolean(pendingDose), 'view has due/missed dose', pendingDose ? `${pendingDose.status} unconfirmed ${pendingDose.unconfirmedForHours}h` : `doses=${JSON.stringify(view.doses)}`);
    expect(
      !view.doses.some((dose) => dose.requestId === pausedRequest.id || dose.requestId === asNeededRequest.id),
      'paused + as-needed regimens produce no doses',
    );

    /* --- 9. Bot: family-share-unconfirmed (real write path, fake push) - */
    const unconfirmed = await runFamilyShareUnconfirmed(
      { patientRef: `Patient/${patientA.id}` },
      {
        fhir,
        sendPush: async (messages) => {
          sentMessages.push(...messages);
          return messages.map(() => ({ ok: true }));
        },
      },
      {
        dryRun: false,
        defaultTimezone: config.TAKT_DEFAULT_TIMEZONE,
        unconfirmedHours: baseConfig.TAKT_UNCONFIRMED_HOURS,
        maxAgeHours: baseConfig.TAKT_MAX_AGE_HOURS,
        channelId: baseConfig.TAKT_PUSH_CHANNEL_ID,
        quietHours: { startHour: 0, endHour: 0 }, // live quiet hours would block evening runs
      },
    );
    expect(unconfirmed.unconfirmedDoseCount === 1, 'unconfirmed: selected the 3h-old dose', JSON.stringify(unconfirmed));
    expect(unconfirmed.recipientCount === 1, 'unconfirmed: 1 recipient (linked RelatedPerson)');
    expect(sentMessages.length === 1, 'unconfirmed: push message built', sentMessages[0] ? JSON.stringify(sentMessages[0]) : '');
    expect(
      sentMessages[0]?.data?.type === 'family-share-unconfirmed' && sentMessages[0]?.channelId === 'family-share',
      'push message shape (type + channelId)',
    );
    expect(unconfirmed.sentCount === 1, 'unconfirmed: claim written + marked completed', `sent=${unconfirmed.sentCount}`);

    /* --- 10. Dedupe: dry run right after must skip -------------------- */
    const dedupe = await runFamilyShareUnconfirmed(
      { patientRef: `Patient/${patientA.id}` },
      { fhir, sendPush: async (messages) => messages.map(() => ({ ok: true })) },
      {
        dryRun: true,
        defaultTimezone: config.TAKT_DEFAULT_TIMEZONE,
        unconfirmedHours: baseConfig.TAKT_UNCONFIRMED_HOURS,
        maxAgeHours: baseConfig.TAKT_MAX_AGE_HOURS,
        quietHours: { startHour: 0, endHour: 0 },
      },
    );
    expect(dedupe.skippedCount === 1 && dedupe.wouldSendCount === 0, 'unconfirmed: dry-run dedupes against sent Communication', JSON.stringify(dedupe));

    /* --- 11. Bot: family-share-scan ----------------------------------- */
    const scan = await runFamilyShareUnconfirmedScan({ fhir }, { dryRun: true, maxPatients: 200, defaultTimezone: config.TAKT_DEFAULT_TIMEZONE, quietHours: { startHour: 0, endHour: 0 } });
    const ours = scan.results.find((result) => patientA.id !== undefined && result.patientRef === `Patient/${patientA.id}`);
    expect(
      Boolean(ours),
      'bot family-share-scan: found our patient tenant-wide',
      ours && 'summary' in ours ? JSON.stringify(ours.summary) : `blockers=${JSON.stringify(scan.blockers)}`,
    );

    /* --- 12. Bot: backfill-medication-scope --------------------------- */
    const backfill = await runMedicationScopeBackfill(fhir, { maxPatients: 200 });
    expect(backfill.updatedCount >= 1 && backfill.conflicts.length === 0, 'bot backfill-medication-scope: medication scoped', `updated=${backfill.updatedCount} conflicts=${backfill.conflicts.length}`);
    const scopedMedication = await fhir.read<MedicationResource>(`/fhir/R4/Medication/${medication.id}`);
    expect(
      (scopedMedication.identifier ?? []).some((identifier) => identifier.system === PATIENT_SCOPE_SYSTEM && identifier.value === patientA.id),
      'medication carries patient-scope identifier',
    );

    /* --- 13. Bot: erasure (also cleans everything up) ------------------ */
    if (patientAId) {
      const erasure = await runErasure({ patientRef: `Patient/${patientAId}`, dryRun: false }, { fhir });
      expect(erasure.patientDeleted, 'bot erasure: patient deleted', JSON.stringify(erasure.deleted));
      expect(
        (erasure.failed ?? []).length === 0,
        'bot erasure: no failed deletions',
        JSON.stringify(erasure.failed ?? []),
      );
    }
  } finally {
    /* --- 14. Fallback cleanup for whatever erasure did not cover ------ */
    for (const resource of [...created].reverse()) {
      if (resource.resourceType === 'Patient' && resource.id === patientAId) continue; // erasure handled it
      try {
        await fhir.delete(`/fhir/R4/${resource.resourceType}/${resource.id}`);
      } catch {
        // already gone — fine
      }
    }
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed${failures.length ? `\n  ${failures.join('\n  ')}` : ''}\n`);
  process.exitCode = failed > 0 ? 1 : 0;
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
