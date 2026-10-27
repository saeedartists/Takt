#!/usr/bin/env npx tsx
/* eslint-disable no-console -- this is a CLI tool; console output is the point. */
/*
 * Live Ovok preflight — point it at the real tenant you have attached and it
 * verifies the exact contracts Takt depends on. Safe to re-run: every write is
 * a conditional create for a uniquely-named test resource, replay-checked,
 * then deleted.
 *
 *   npm run verify:live
 *
 * Env:
 *   EXPO_PUBLIC_OVOK_API_URL        (default https://api.ovok.com; the
 *                                   practice-stdi sandbox tenant lives at
 *                                   https://api.sandbox.ovok.com)
 *   EXPO_PUBLIC_OVOK_TENANT_CODE    the code from the Ovok Console
 *   TAKT_VERIFY_EMAIL / TAKT_VERIFY_PASSWORD  optional: a real account to
 *                                   unlock the authenticated checks
 *   TAKT_VERIFY_TYPE                'Patient' (default) or 'Practitioner'
 *
 * Checks:
 *   1. Service up + auth contract      (unauthenticated /auth/me → 401)
 *   2. Login contract                  (SDK login; MFA start if enabled)
 *   3. Conditional create replay       (MedicationAdministration + Consent:
 *                                       If-None-Exist yields the same id twice)
 *   4. Family email search             (RelatedPerson?email=)
 *   5. Cleanup + operator checklist
 *
 * Note: in Node the SDK client has no storage, so after the SDK contract
 * check we fall back to a raw PKCE login to obtain the bearer token.
 */

import { createHash, randomBytes } from 'node:crypto';
import { OvokClient } from '@ovok/core';
import type { Bundle, Consent, MedicationAdministration } from '@medplum/fhirtypes';

const API_URL = (process.env.EXPO_PUBLIC_OVOK_API_URL ?? 'https://api.ovok.com').replace(/\/+$/, '');
const TENANT = process.env.EXPO_PUBLIC_OVOK_TENANT_CODE ?? '';
const EMAIL = process.env.TAKT_VERIFY_EMAIL ?? '';
const PASSWORD = process.env.TAKT_VERIFY_PASSWORD ?? '';
const LOGIN_TYPE = process.env.TAKT_VERIFY_TYPE === 'Practitioner' ? 'Practitioner' : 'Patient';

const TAKT_EXT_DOSE_EVENT = 'https://actimi.com/fhir/takt/dose-event';
const TAKT_EXT_CONSENT = 'https://actimi.com/fhir/takt/consent';
const RUN_KEY = `takt-verify-${Date.now()}`;

let passed = 0;
let failed = 0;

const ok = (label: string, detail = '') => {
  passed += 1;
  console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
};
const fail = (label: string, detail = '') => {
  failed += 1;
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
};
const skip = (label: string, why: string) => {
  console.log(`  SKIP  ${label} — ${why}`);
};

const fetchRaw = async (path: string) =>
  fetch(`${API_URL}${path}`, { headers: { 'content-type': 'application/json' } });

/** FHIR call the same way the app does it: bearer token + if-none-exist header. */
const fhirFetch = async <T,>(path: string, method: string, body?: string, headers: Record<string, string> = {}, token?: string): Promise<{ status: number; body: unknown }> => {
  const res = await fetch(`${API_URL}/fhir/R4/${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body } : {}),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    // non-JSON error body — keep the text
  }
  return { status: res.status, body: parsed as T };
};

const main = async () => {
  console.log(`\nTakt live preflight → ${API_URL}${TENANT ? ` (tenant ${TENANT})` : ''}\n`);

  // 1. Service up + unauthenticated contract.
  try {
    const res = await fetchRaw('/auth/me');
    if (res.status === 401 || res.status === 403) {
      ok('auth contract (unauthenticated /auth/me → auth required)', `status ${res.status}`);
    } else {
      fail('auth contract', `unexpected status ${res.status} for /auth/me without credentials`);
    }
  } catch (error) {
    fail('service reachable', error instanceof Error ? error.message : String(error));
  }

  const client = new OvokClient({ baseUrl: API_URL, fhirUrlPath: '/fhir/R4/' });

  // 2. Login contract (Patient sign-in needs the tenant code, like the app).
  let token: string | undefined;
  if (EMAIL && PASSWORD) {
    if (LOGIN_TYPE === 'Patient' && !TENANT) {
      skip('login contract', 'Patient login requires EXPO_PUBLIC_OVOK_TENANT_CODE');
    } else {
      try {
        const response = await client.login(
          LOGIN_TYPE === 'Patient'
            ? { email: EMAIL, password: PASSWORD, type: 'Patient', tenantCode: TENANT }
            : { email: EMAIL, password: PASSWORD, type: 'Practitioner', tenantCode: TENANT || undefined },
        );
        if ('nextStep' in response) {
          ok('login contract (MFA start returned)', 'nextStep=mfa — the MFA route exists; verify a code manually in the app');
        } else {
          token = client.getAccessToken() ?? undefined;
          ok('login contract (session exchanged)', token ? `token ${token.slice(0, 8)}…` : '');
        }
      } catch (error) {
        fail('login contract', error instanceof Error ? error.message : String(error));
      }

      // Node fallback: the SDK client drops the session without storage, so
      // repeat the exact PKCE flow the app runs and keep the access token.
      if (!token) {
        try {
          const verifier = randomBytes(32).toString('base64url');
          const challenge = createHash('sha256').update(verifier).digest('base64url');
          const start = await fetch(`${API_URL}/auth/tenant/${LOGIN_TYPE}/login/start`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(
              LOGIN_TYPE === 'Patient'
                ? { email: EMAIL, password: PASSWORD, codeChallenge: challenge, codeChallengeMethod: 'S256', tenantCode: TENANT }
                : { email: EMAIL, password: PASSWORD, codeChallenge: challenge, codeChallengeMethod: 'S256' },
            ),
          });
          const startBody = (await start.json()) as { sessionCode?: string; profiles?: { tenantCode?: string }[]; message?: string };
          if (!start.ok || !startBody.sessionCode) {
            fail('login fallback (raw PKCE)', `status ${start.status} ${startBody.message ?? ''}`);
          } else {
            const tenantForExchange =
              LOGIN_TYPE === 'Patient'
                ? TENANT
                : (startBody.profiles?.find((p) => p.tenantCode === TENANT)?.tenantCode ?? startBody.profiles?.[0]?.tenantCode ?? TENANT);
            const exchange = await fetch(`${API_URL}/auth/tenant/${LOGIN_TYPE}/login/token`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ sessionCode: startBody.sessionCode, codeVerifier: verifier, tenantCode: tenantForExchange }),
            });
            const exchangeBody = (await exchange.json()) as { accessToken?: string; message?: string };
            if (!exchange.ok || !exchangeBody.accessToken) {
              fail('login fallback (raw PKCE)', `status ${exchange.status} ${exchangeBody.message ?? ''}`);
            } else {
              token = exchangeBody.accessToken;
              ok('login fallback (raw PKCE session)', `token ${token.slice(0, 8)}…`);
            }
          }
        } catch (error) {
          fail('login fallback (raw PKCE)', error instanceof Error ? error.message : String(error));
        }
      }
    }
  } else {
    skip('login contract', 'set TAKT_VERIFY_EMAIL / TAKT_VERIFY_PASSWORD to exercise');
  }

  // 3 + 4 need a session.
  if (token) {
    // Ovok enforces referential integrity, so every write probe hangs off a
    // real, uniquely-named Patient (mirrors the app, which always has one).
    let patientId: string | undefined;
    try {
      const res = await fhirFetch<{ id?: string }>(
        'Patient',
        'POST',
        JSON.stringify({
          resourceType: 'Patient',
          active: true,
          name: [{ family: 'TaktVerify', given: ['Probe'] }],
          identifier: [{ system: TAKT_EXT_DOSE_EVENT, value: RUN_KEY }],
        }),
        {},
        token,
      );
      if (res.status >= 200 && res.status < 300 && (res.body as { id?: string }).id) {
        patientId = (res.body as { id?: string }).id;
        ok('probe Patient create', patientId);
      } else {
        fail('probe Patient create', `status ${res.status} — ${JSON.stringify(res.body).slice(0, 120)}`);
      }
    } catch (error) {
      fail('probe Patient create', error instanceof Error ? error.message : String(error));
    }

    const conditionalCreate = async <T extends { id?: string }>(label: string, path: string, resource: Record<string, unknown>, search: string) => {
      try {
        const first = await fhirFetch<T>(path, 'POST', JSON.stringify(resource), { 'if-none-exist': search }, token);
        const second = await fhirFetch<T>(path, 'POST', JSON.stringify(resource), { 'if-none-exist': search }, token);
        const firstId = first.body ? (first.body as T).id : undefined;
        const secondId = second.body ? (second.body as T).id : undefined;
        if (first.status === 201 && token && second.status === 200 && firstId && secondId === firstId) {
          ok(`${label}: conditional create replays to the same id`, firstId);
        } else if (first.status >= 400 || second.status >= 400) {
          fail(`${label}: conditional create`, `status ${first.status}/${second.status} — ${JSON.stringify(first.body).slice(0, 160)}`);
        } else {
          fail(`${label}: conditional create replay`, `first=${firstId} second=${secondId} (statuses ${first.status}/${second.status})`);
        }
        return firstId;
      } catch (error) {
        fail(`${label}: conditional create`, error instanceof Error ? error.message : String(error));
        return undefined;
      }
    };

    const maId = patientId
      ? await conditionalCreate<MedicationAdministration>(
          'MedicationAdministration',
          'MedicationAdministration',
          {
            resourceType: 'MedicationAdministration',
            status: 'in-progress',
            subject: { reference: `Patient/${patientId}` },
            effectiveDateTime: new Date().toISOString(),
            medicationCodeableConcept: { text: 'Takt verify probe' },
            identifier: [{ system: TAKT_EXT_DOSE_EVENT, value: RUN_KEY }],
          },
          `identifier=${TAKT_EXT_DOSE_EVENT}|${RUN_KEY}`,
        )
      : undefined;

    const consentId = patientId
      ? await conditionalCreate<Consent>(
          'Consent',
          'Consent',
          {
            resourceType: 'Consent',
            status: 'active',
            patient: { reference: `Patient/${patientId}` },
            dateTime: new Date().toISOString(),
            scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }] },
            category: [{ coding: [{ system: 'http://loinc.org', code: '59284-0', display: 'Patient Consent' }] }],
            policyRule: { text: 'takt-verify' },
            identifier: [{ system: TAKT_EXT_CONSENT, value: `${RUN_KEY}-patient-active` }],
          },
          `identifier=${TAKT_EXT_CONSENT}|${RUN_KEY}-patient-active`,
        )
      : undefined;

    // 4. Relative email search (family features).
    try {
      const probe = await fhirFetch<Bundle>('RelatedPerson?email=takt-verify-probe@example.com', 'GET', undefined, {}, token);
      if (probe.status === 200 && probe.body && 'resourceType' in (probe.body as object)) {
        ok('RelatedPerson email search (AccessPolicy allows ?email=)', `bundle ${(probe.body as Bundle).total ?? '(no total field)'}`);
      } else if (probe.status === 403) {
        fail('RelatedPerson email search', '403 — ask the Ovok admin to allow relatives to search RelatedPerson by email');
      } else {
        fail('RelatedPerson email search', `unexpected status ${probe.status}`);
      }
    } catch (error) {
      fail('RelatedPerson email search', error instanceof Error ? error.message : String(error));
    }

    // 5. Cleanup.
    const deletions: [string, string | undefined][] = [
      ['MedicationAdministration', maId],
      ['Consent', consentId],
      ['Patient', patientId],
    ];
    for (const [type, id] of deletions) {
      if (!id) continue;
      const res = await fhirFetch(`${type}/${id}`, 'DELETE', undefined, {}, token);
      if (res.status === 200 || res.status === 202 || res.status === 204) {
        ok(`cleanup ${type}/${id}`);
      } else {
        fail(`cleanup ${type}/${id}`, `status ${res.status} — delete this test resource manually`);
      }
    }
  }

  // Operator checklist.
  console.log('\nOperator checklist (needs the Ovok Console, cannot be verified from here):');
  console.log('  [ ] Reset email callback → takt://auth/reset-complete?id={id}&secret={secret} (or an https URL that opens the same route)');
  console.log('  [ ] Reset emails enabled for Patient (and Practitioner) accounts');
  console.log('  [ ] AccessPolicy allows relatives to search RelatedPerson by email');
  console.log('  [ ] Rate limits per IP: login 10/min, register 4/h, reset-password 3/h — do not hammer them');
  console.log('  [ ] Tenant code in EXPO_PUBLIC_OVOK_TENANT_CODE matches the Console exactly');

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
};

void main();
