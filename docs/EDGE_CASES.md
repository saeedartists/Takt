# Edge-case ledger

Status legend: ✅ resolved · 🟡 open, mitigated · 🔴 open, requires live server / admin action
Checked against: Ovok docs (docs.ovok.com, 2026-10 contract) + installed SDK declarations (`@ovok/core@0.4.42`, `@medplum/* 4.3.6`).

## Auth & sessions (multi-device)

| # | Edge case | Status | Notes |
| --- | --- | --- | --- |
| A1 | Same account signed in on two devices | ✅ supported | Sessions are one-per-sign-in (`GET /auth/session` lists all; each device holds its own tokens in its own `ExpoClientStorage`). No shared-token race — rotation (`POST /auth/refresh-token` returns new refresh token) happens per session. Refresh cap 600/min/caller; client refreshes at most once/hour grace 60s. |
| A2 | Another device revokes this session | ✅ fixed | `(tabs)/_layout` guard now re-checks `/auth/me` on every foreground, redirecting to sign-in instead of rendering stale screens behind 401s. |
| A3 | Data freshness across devices | ✅ fixed | React Query `focusManager` was never wired to RN AppState (refetchOnWindowFocus silently dead). Wired in `app/_layout.tsx`; foreground now refetches stale queries (staleTime 30s). |
| A4 | MFA-enforced project | ✅ handled | `login()` pending-step (`nextStep: 'mfa'`) → code screen → `verify(code)` completes same attempt. |
| N | MFA exercised against a live tenant | 🔴 open | Flow matches documented contract; must be smoke-tested on the production tenant once attached. Run `npm run verify:live` with account credentials. |
| A5 | Registration resolves to clinician-invite step (project misconfig) | ✅ handled | Neutral message, no crash. |
| A6 | Sign-out revokes server session | ✅ handled | `logout()` (server revocation + local clear, offline-tolerant). |
| A7 | Sign-in while refresh token refused (project login disabled) | ✅ documented | Refresh returns 403 and ends session → foreground guard sends user to sign-in. |
| A8 | Consent acceptance | ✅ by design | Device-local flag (AsyncStorage): each device re-asks once, per-device policy. |
| A9 | Multi-account per device (switcher UI) | 🟡 open | SDK 0.4.42 has `getSavedAccounts`/`switchAccount`/`removeAccount`; Takt is single-active-login. Tracked as future feature, not a defect. |
| A10 | Password reset email returns to the app | ✅ fixed | New deep-link route `app/auth/reset-complete.tsx` → `src/screens/auth/reset-complete-screen.tsx`: parses `id`/`secret`, validates 8+ chars + match, calls `ovokClient.setPasswordFromReset`, lands on success → sign-in. Expired/incomplete links get a calm "request a new email" state (no crash). Console must point the reset callback at `takt://auth/reset-complete?id={id}&secret={secret}`. |
| A11 | Live build launches with service down | ✅ fixed | Distinct fates: `needs-config` → `/setup` (developer diagnostics), `backend-unreachable` → new `app/backend-down.tsx` (friendly retry screen: re-runs gate, restores session when the service returns, "Connection details" escape hatch to `/setup`). Both index gate and `(tabs)` foreground guard route through it. |
| A12 | Mock server shipped in a store binary | ✅ guarded | Root layout: `!__DEV__ && env.ovokMockEnabled` → `console.error` + `captureError('global', …)` sink event. Mock install remains self-gating; this belt-and-braces makes the misconfiguration loud. |

## FHIR data layer

| # | Edge case | Status | Notes |
| --- | --- | --- | --- |
| F1 | Duplicate dose record on retried create | ✅ fixed | Conditional create: stable identifier per (plan, scheduled time, action) + `If-None-Exist`; mock server mirrors the semantics. |
| N | Live server honors `If-None-Exist` on `POST /fhir/R4/MedicationAdministration` | 🔴 open | Standard FHIR; verify on production server with `npm run verify:live` (checks MedicationAdministration + Consent replay, cleans up after itself). Worst case if unsupported: pre-fix behavior (plain create, idempotent only within one process). |
| F2 | Throttling (429) hammering | ✅ handled | Retry honors `Retry-After` (clamped 0.25–30s), 1s backoff for blank 5xx, single bounded retry, auth/validation never retried. |
| F3 | FHIR paging beyond first page | 🟡 open | `useDoseEvents` reads one page (`_count=500`); >500 lifetime administrations truncate silently. Add `Link`-header follow-up when needed. |
| F4 | Date arithmetic across timezones | ✅ fixed | `normalizeDateInput` pinned to UTC noon (documents its own contract); UI formats locally. |
| F5 | Optimistic updates vs server truth | ✅ handled | Mutations snapshot previous cache, roll back on error, invalidate on settle. |
| F6 | Missing/absent bundle `entry` | ✅ handled | Mock enforces absent-`entry` fidelity; fixtures assert it. |
| F7 | Stale `meta.versionId` write conflicts | ✅ handled | Project settings use If-Match/E-Tag round trip (mock mirrors). |
| F8 | `_sort=-_lastUpdated` / `email` search validity | ✅ verified | `email` is a documented R4 RelatedPerson search param; `patient` reference and `_sort` are standard. |

## Family sharing

| # | Edge case | Status | Notes |
| --- | --- | --- | --- |
| S1 | Relative without own account invited | ✅ handled | Status 'invited' → accept flow → 'accepted'; patient's own preview mode protected. |
| S2 | Revoke while relative is looking | ✅ handled | Relative screen re-fetches grants on every focus; revoked → blocked immediately, no actions available (screen is read-only by design). |
| S3 | Relative data leakage beyond §11 scope | ✅ handled | Relative capabilities locked: no regimen edit, no diary, no report export; `receive-unconfirmed-reminder` only enabled. |
| S4 | Cross-patient reads under Ovok AccessPolicies | 🔴 open, admin | Live server must allow links: relative (same project) may read linked patient's Patient/Medication/MedicationRequest/MedicationAdministration + search own RelatedPerson by email + read shared Consent. Requires project AccessPolicy configuration by the admin; app cannot self-grant. Verify on go-live. |
| S5 | Patient and relative on different tenants | ✅ by design | Single-tenant deployment (`EXPO_PUBLIC_OVOK_TENANT_CODE` per build); relative registers into the same tenant. |
| S6 | Duplicate invite for same relative email | 🟡 open | Creates a second RelatedPerson; relative sees two identical shares. Low harm; dedupe is a product decision. |
| N | RelatedPerson accept race (accept from two devices) | ✅ handled | Acceptance is idempotent (PUT of links/acceptedAt onto the same resource; same extension URLs replaced). |
| S7 | Shared-with-me N+1 queries | 🟡 open | One consent+patient read per RelatedPerson row (≤50). Fine at family scale; revisit only if a deployment grows large. |

## Schedule & supply engine

| # | Edge case | Status | Notes |
| --- | --- | --- | --- |
| D1 | Same dose recorded on one device shows unrecorded on another (different timezone) | ✅ fixed | Plan slot identity (`TAKT_EXT.planSlot`) is frozen with the recorder's wall clock at record time; `indexEvents` matches by slot first, viewer's local key second. Events recorded before this fix stay local-keyed (correct on their own device, cross-device only via slot from now on). |
| D2 | DST transition shifts the wall-clock key of a recorded dose | ✅ fixed | Same frozen-slot mechanism: the slot is computed once at record time on the recorder's calendar, so the occurrence grid (`planSlotKey` = plan time string + local date) stays stable. |
| D3 | Undo of a taken dose does not give the units back | ✅ fixed | `restoreSupply` (mirror of `deductSupply`); `useUndoDose` restores when the undone event was completed. Clears out/low-supply nudge flags when back above thresholds; no-op when no count was ever set. Regression-tested in `supply-tracker.test.ts`. |
| D4 | Per-intake quantity (e.g. 2 tablets) ignored by supply | ✅ fixed | `dosageQuantity` flows DoseOccurrence → `recordDose` → `deductSupply(quantity)`; the lock-screen "Taken" action resolves the quantity from the plan. Default stays 1. |
| D5 | Supply count diverges across devices | 🟡 open, by design | Supply is device-local (AsyncStorage): each device keeps its own counter/refills. Reminder + deduction run per device. Server-side packaging on the Medication resource would be a bigger alignment feature. |
| D6 | Follow-up reminder still fires after the dose is confirmed between scheduling and firing | ✅ handled | Reconcile re-runs whenever `confirmedDoseKeys` change (events invalidated), so the scheduled follow-up is cancelled at the next sync. |
| D7 | Dose reminder rings although the dose was taken early | 🟡 minor UX | `confirmedDoseKeys` suppress follow-ups only; the dose notification itself still fires. Harmless: tapping "Taken" hits the conditional-create guard (same identifier) and cannot double-log. Candidate suppression: drop notifications whose slot matches a recorded event during reconcile. |

## Pages & flows (report · diary · week · care · consent)

| # | Edge case | Status | Notes |
| --- | --- | --- | --- |
| P1 | Retried / double-tapped accept or withdraw piles up duplicate Consent records | ✅ fixed | `writeConsent` now uses conditional create: identifier per (patient, status) + `If-None-Exist`; status in the identity keeps a fresh accept possible after a withdraw. Mock server handles the guard generically. |
| P2 | Re-consent after data reset wipes the stored patient name (partial entry) | ✅ fixed | Consent screen prefills first/last name from the profile, never overriding user edits; busy state covers `updatePatient`. |
| P3 | PDF report only carries the local device's diary (mood/symptoms) | 🟡 open, by design | Diary and care contacts are on-device only (privacy by design). On the doctor's report a second device's diary is missing. Decision needed: FHIR-sync the diary if clinical completeness wins; else document in the report disclaimer. |
| P4 | Local stores (diary, care, report-review, consent-audit) read-modify-write race | 🟡 minor | Rapid concurrent saves can lose one edit; user-paced taps make it unlikely, blast radius local-only. Same pattern across the four local modules. |
| P5 | Week/report/history denominators drift apart | ✅ verified | All three build from the same `buildHistory`; report-summary consumes that output (parity by construction) and the report-parity fixtures pin it. Today's still-open doses are excluded everywhere. |
| P6 | Appointment day math around DST / untimed visits | ✅ verified | `daysUntil` counts local calendar days (DST-tested); untimed visits pin to noon so day maths never slips. |
| P7 | Diary read drops corrupt entries (e.g. mood out of range) | ✅ by design | Entries are never repaired to a fake value; a corrupt day is dropped whole. Sanitization is regression-tested in `diary-care.test.ts`. |

## Runtime & infra

| # | Edge case | Status | Notes |
| --- | --- | --- | --- |
| R1 | Crash without providers | ✅ fixed | Two-layer ErrorBoundary + `error-reporting` seam. |
| R2 | OvokClient boot before polyfills exist | ✅ fixed | CommonJS `index.js` entry: polyfills before `expo-router/entry`; `_layout` no longer races imports. |
| R3 | Sentry / crash sink not attached | 🟡 open | `captureError` currently logs in `__DEV__`; plug a sink before public launch. |
| R4 | Mock leaking into live builds | ✅ protected | Mock installs only when `isMockEnabled()`; `.env.local` is gitignored, `EXPO_PUBLIC_OVOK_MOCK` must be removed/0 for live. |
| R5 | Offline long-horizon | 🟡 open | Optimistic updates reconcile, but no durable offline queue (SDK `offlineQueue` opt-in unused). Short blips fine; extended airtime drops actions. |

## Capacity (documented platform limits)

- Auth: `login/start` 10/min/IP · `login/token` 30/min/IP · `login/mfa` 5/min/IP · `register` 5/min/IP · error responses delayed ≥1s.
- Session: `POST /auth/refresh-token` 600/min/caller (client refreshes ~1/h/device).
- Per-user server cost: ~10 FHIR reads on load + searches ≤ 500-resource pages; family sharing adds ≤ 3 queries/relative screen.
- Client is stateless per device besides cached queries and AsyncStorage flags; capacity is bounded by the Ovok project/tenant infrastructure, not app code. A single family deployment is unconstrained; office-scale deployments hit sign-in rate limits only during bursting (all traffic through one IP).
- Unknown-but-server-side: WebSocket subscriptions feature switch (unused by Takt today), per-project storage quotas, real `SearchSet` `_count` caps. Set expectations with Ovok admin on go-live.
