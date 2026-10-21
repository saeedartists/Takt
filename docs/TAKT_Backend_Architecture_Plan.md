# Takt — Refined Backend & Server-Side Plan

**Status:** For approval  
**Date:** 2026-10-20  
**Backend model:** Ovok-managed tenant (confirmed)  
**Related:** `TAKT_v1_Development_Plan.md`, `TAKT_Production_Completion_Plan.md`, `TAKT_Family_Sharing_v1_Foundation.md`, `TAKT_Auth_Blocker_Investigation.md`, `TAKT_FHIR_Repository_Professionalization.md`

---

## 1. Executive Summary

- Takt is already a FHIR app. Its backend is **Ovok**; a second database would duplicate auth, FHIR, audit, and compliance work.
- The **v1.0 launch backend needs almost no custom API code**. The work is tenant/auth configuration, FHIR data contracts, access policies, production environment, and erasure tooling.
- The first real server-side runtime code is for **v1.1 family sharing**: a read API, push-token registration, and the unconfirmed-dose notification bot.
- Family-sharing entry points must be **gated in production until v1.1 server support is live**. The current UI is mock-complete but has no live authorization path.
- The two hard external dependencies are: Actimi enabling patient auth on the tenant, and Ovok confirming how a bot can trust the calling user.
- The agreed direction is **offline-first with background reconciliation**: Takt stays fully usable without a connection, then syncs dose events and plan changes to Ovok when connectivity returns. This satisfies both the Ovok requirement and the offline-first requirement.

This plan replaces the earlier architecture draft. It is a plan only; no server implementation is included. A background-sync addendum is in section 14.

---

## 2. Scope

### 2.1 v1.0 — launch-critical backend

Everything needed for a real patient to register, use the app, and have their data isolated and erasable:

1. Live tenant and patient auth.
2. FHIR contracts that the app already assumes.
3. Patient-only access policy and proof of isolation.
4. Production EAS environment.
5. GDPR erasure and consent audit.
6. Family-sharing UI disabled until v1.1.
7. Offline-first local store, durable outbox, and background reconciliation with Ovok.

### 2.2 v1.1 — family-sharing backend

The server-side pieces that cannot exist in the mobile app:

1. Push-token registration.
2. Relative read API with consent and revocation checks.
3. One quiet notification per unconfirmed dose, with dedupe.
4. Server-side timezone handling for dose schedules.

### 2.3 Explicitly out of scope

- A custom non-FHIR API or database.
- Server-side PDF/report generation.
- Medication interaction or decision support.
- Practitioner/clinician backend.
- Admin web portal.
- Cross-device sync beyond what Ovok provides.

---

## 3. Architecture

```text
Takt mobile app
  ├─ @ovok/core auth + FHIR R4
  ├─ local dose reminders
  ├─ patient compartment data
  └─ v1.1: push-token registration + family-share API calls

Ovok tenant
  ├─ patient registration/login, sessions, email verification/reset
  ├─ FHIR R4 store, audit, backups
  ├─ patient access policy (own compartment only)
  └─ v1.1 server code
       ├─ family-share-today (relative read API)
       ├─ family-share-unconfirmed (scheduled bot)
       └─ send-push (Expo Push sender)

Takt-owned ops tooling
  ├─ tenant provisioning checks
  ├─ access-policy deployment
  ├─ patient A/B isolation verification
  ├─ live smoke tests
  └─ erasure script
```

### 3.1 Backend responsibilities

| Layer | Owns |
|---|---|
| Ovok | Identity, sessions, FHIR storage, audit, backup, access enforcement |
| Takt app | UI, local reminders, adherence computation, consent capture, PDF/CSV export |
| Takt server/ops | Provisioning, policies, verification, erasure, v1.1 bots |
| Expo Push | Delivery of the v1.1 quiet notification |

---

## 4. Current Gaps

| Gap | Impact | v1.0 or v1.1 |
|---|---|---|
| Patient login/registration disabled on tenant | No live sign-in | v1.0 |
| Settings write endpoint returns 404 | Cannot enable auth via tooling | v1.0 |
| `socialLoginClientId` uses the wrong env value | Client identity/social login may fail | v1.0 |
| Production EAS env is empty; all profiles use mock | Store build shows mock data | v1.0 |
| No patient access policy or A/B isolation evidence | Cannot prove cross-patient isolation | v1.0 |
| No erasure workflow | GDPR erasure cannot be fulfilled | v1.0 |
| `Medication` has no patient-scoped identifier | Access policy cannot restrict medication reads | v1.0 |
| `RelatedPerson?email=` is mock-only | Live relative lookup fails | v1.1 |
| No family-share server authorization | Relative gets 403 on live data | v1.1 |
| No push-token registration | Quiet notification cannot be delivered | v1.1 |
| No family-share notification bot | Brief §11 notification unavailable | v1.1 |
| No patient timezone stored server-side | Bot cannot compute local dose times | v1.1 |
| No offline outbox or sync engine | Offline changes are lost or never reach Ovok | v1.0 |
| No client-assigned resource IDs | Retries can duplicate dose events | v1.0 |
| No pull cursor or conflict policy | Reinstall/second device cannot reconcile safely | v1.0 |
| No sync-state UX | Users cannot tell whether data reached Ovok | v1.0 |

---

## 5. v1.0 Workstreams

### W1 — Tenant and auth

**Why:** no live account, no app.

**Tasks**
- Obtain tenant code, environment URLs, mobile client app ID, and server credentials.
- Enable patient login and registration.
- Configure email verification, password policy, SMTP, reset templates, and reset deep link.
- Fix `src/lib/ovok-client.ts:13` to use `env.ovokClientId`.
- Add a live smoke path for register, sign in, refresh, sign out, and reset.

**Depends on:** Actimi/Ovok ops. The settings endpoint mismatch is an external blocker.

**Done when:** a new patient registers and signs in on staging; token refresh works; reset email arrives and opens the app.

---

### W2 — FHIR data contract

**Why:** the app assumes fields and search behavior that must be true on live FHIR.

**Tasks**
- Add a patient-scoped identifier to `Medication` so the access policy can restrict it.
- Confirm live support for `Consent?patient=`, `RelatedPerson?patient=`, `MedicationRequest?subject=`, `MedicationAdministration?subject=`, and `Device?patient=`.
- Replace mock-only search parameters with supported FHIR searches.
- Add a live contract test that creates and reads one of each resource.
- Confirm the existing Takt extensions are accepted unchanged.

**Depends on:** W1.

**Done when:** all v1.0 resources round-trip on staging and no mock-only search remains in the patient path.

---

### W3 — Patient access policy and isolation

**Why:** Article 9 data must be provably isolated per patient.

**Tasks**
- Define the patient access policy: own `Patient`, own `Medication` by identifier, and own `MedicationRequest`, `MedicationAdministration`, `Consent`, `RelatedPerson`, and `Device`.
- Deploy the policy to staging.
- Create Patient A and Patient B with realistic test data.
- Run the A/B isolation matrix across every resource type.
- Capture evidence in `docs/TAKT_AB_Isolation_Test_Matrix.md`.
- Confirm the app cannot read another patient by changing IDs or search parameters.

**Depends on:** W2.

**Done when:** A cannot read B’s data through any app path, and the evidence is signed off.

---

### W4 — Production environment and release path

**Why:** a live backend is useless if the store build still runs mock mode.

**Tasks**
- Add public Ovok values to the production EAS environment.
- Remove `EXPO_PUBLIC_OVOK_MOCK=1` from preview and production.
- Confirm the client ID, tenant code, API URL, and deep-link scheme.
- Run a production-config build against staging before production.
- Update `docs/PUBLISH.md` and the release runbook.

**Depends on:** W1.

**Done when:** a preview/production build points at the real tenant and no mock flag is present.

---

### W5 — Erasure, retention, and consent audit

**Why:** account deletion and consent history are launch requirements.

**Tasks**
- Add an in-app “delete account” path with confirmation and re-authentication.
- Implement an admin-only erasure procedure covering the patient compartment and auth user.
- Revoke active family-share consents before deletion.
- Confirm backup retention and deletion propagation with Actimi.
- Record consent grant/withdraw evidence without retaining unnecessary PHI.
- Update the DPIA with retention and erasure facts.

**Depends on:** W1, W3.

**Done when:** a staging test patient and all compartment resources are gone; relatives see revoked; the DPIA reflects the process.

---

### W6 — Family-sharing gate

**Why:** the v1.1 server path does not exist yet.

**Tasks**
- Put the family-sharing entry points behind a server-driven feature flag.
- Default the flag off in production until v1.1 gates pass.
- Keep the preview/mock experience available for development.

**Depends on:** none.

**Done when:** production builds cannot create or accept a family share until the server path is live.

---

## 6. v1.1 Workstreams

### W7 — Push-token registration

**Tasks**
- Register the Expo push token as a patient-owned `Device` on login and permission grant.
- Deactivate the device on logout.
- Re-register on app start when the token rotates.
- Store the patient’s IANA timezone on the patient record for server-side schedule calculation.

**Done when:** a test device can be resolved from the patient’s active `Device`, and the bot can read the patient timezone.

---

### W8 — Family-share read API

**Tasks**
- Confirm Ovok bot caller identity. This is a spike, not an assumption.
- Implement a bot that verifies the caller, the `RelatedPerson` link, and the active `Consent`.
- Return only today’s dose statuses, the patient label, and the blocked-capability list.
- Re-check consent on every call so revocation is immediate.
- Switch the relative-side app from direct FHIR reads to the bot.
- Rate-limit the endpoint and validate every input.

**Fallback if caller identity is unavailable:** signed short-lived grant token or a dynamic per-relative access policy. Both are less desirable; decide after the spike.

**Done when:** an accepted relative sees today’s statuses; a revoked relative gets no data on the next call; a non-relative gets no data.

---

### W9 — Unconfirmed-dose notification bot

**Tasks**
- Run every 15 minutes over active family-share consents.
- Compute doses in the patient’s timezone, including yesterday’s late doses.
- Select doses more than 2 hours old with no administration.
- Claim each dose with a `Communication` record before sending.
- Send one quiet push through Expo, with no PHI in the payload.
- Apply quiet hours; default 21:00–08:00 patient local time.
- Mark invalid tokens inactive.
- Provide a dry-run mode and a fixed-clock integration test.

**Done when:** one push per unconfirmed dose; duplicate runs send nothing; a taken/skipped dose suppresses the push; quiet hours behave as specified.

---

## 7. Server/Code Boundaries

No code is written yet. When implementation starts, it should stay inside these boundaries:

| Area | Responsibility |
|---|---|
| Tenant provisioning | Idempotent checks and settings; fail loudly on the known endpoint mismatch |
| Access policies | Patient policy, bot policies, deployment and verification |
| FHIR client | Typed read/search/create/update/delete; no PHI in logs |
| Domain logic | Dose schedule, consent checks, dedupe keys; parity with app fixtures |
| Bots | Family-share read, unconfirmed notification, push sender, erasure |
| Ops scripts | A/B isolation, live smoke, test-data creation, erasure |
| Tests | Unit, contract, fixed-clock, and live staging tests |

The app remains the source of truth for local reminders and adherence display. The server does not schedule reminders and does not generate reports.

---

## 8. Data Contract Decisions

| Decision | Why | Phase |
|---|---|---|
| Add `Medication.identifier` with patient scope | Makes medication reads restrictable by access policy | v1.0 |
| Add `Device` for Expo push token | Server needs a patient-owned delivery address | v1.1 |
| Add `Communication` for push dedupe/audit | Idempotency and evidence without a new database | v1.1 |
| Add patient timezone extension | Server must compute local wall-clock doses | v1.1 |
| Keep `RelatedPerson` email in `telecom` | Standard FHIR search; mock `email` parameter is not portable | v1.1 |
| Keep family-share grants in `Consent` | Existing model is sound and auditable | v1.1 |

---

## 9. Credentials

**Mobile app (public only):**
- `EXPO_PUBLIC_OVOK_API_URL`
- `EXPO_PUBLIC_OVOK_TENANT_CODE`
- `EXPO_PUBLIC_OVOK_CLIENT_ID`

**Server/CI (never in the app bundle):**
- `OVOK_API_URL`
- `OVOK_TENANT_CODE`
- Server client ID and secret
- Bot identifiers
- `EXPO_ACCESS_TOKEN` for push
- Scheduler secret if an external scheduler calls the bot

**Request from Actimi/Ovok:**
- Tenant code and environment URLs
- Mobile client application ID
- Server client credentials and allowed scopes
- Confirmation that patient auth is enabled
- SMTP/reset configuration
- Bot runtime and scheduling contract
- Test patient accounts
- Backup retention and erasure behavior

---

## 10. Release Gates

### Gate 1 — Live auth
Register, sign in, refresh, sign out, and reset on staging.

### Gate 2 — Data integrity
Every v1.0 resource round-trips; medication patient scope is present; no mock-only search remains.

### Gate 3 — Isolation
Patient A cannot read Patient B through the app or direct API calls.

### Gate 4 — Erasure
Test patient and compartment are deleted; active shares are revoked; DPIA is updated.

### Gate 5 — Production config
Preview/production builds use the real tenant and have no mock flag.

### Gate 6 — v1.1 family sharing
Accepted relative sees only today’s statuses; revocation is immediate; one quiet push per unconfirmed dose; duplicate runs send nothing.

### Gate 7 — Offline sync
Offline plan edits and dose logs upload exactly once after reconnect; reinstall pulls the same state; duplicate retries create no duplicate events; conflicts follow the agreed rules.

### Gate 8 — Release
`npm run typecheck`, `npm run verify`, server tests, and the staging E2E pass. Unpublish/re-publish decision is recorded.

---

## 11. Risks and Open Decisions

| Risk / decision | Impact | Mitigation |
|---|---|---|
| Ovok settings endpoint remains broken | Auth cannot be enabled | Actimi ops ticket; use the supported admin path |
| Bot caller identity unavailable | Family-share read API cannot trust the requester | Spike first; signed grant token or dynamic policy fallback |
| `RelatedPerson?email=` unsupported live | Relative invites cannot be found | Bot uses `telecom` search |
| `Medication` not patient-scoped | Cross-patient medication read risk | Add identifier and test A/B |
| Patient timezone missing | Bot computes wrong dose times | Store timezone on patient; test DST |
| Family sharing ships before server support | Broken live feature | Feature-gate it off in production |
| Quiet notification at night | Poor relative experience | Default quiet hours; product decision |
| Schedule logic drift | App and bot disagree on “unconfirmed” | Parity fixtures or shared domain module |
| No server credentials yet | v1.1 work blocked | Request credentials now |
| Background tasks are throttled by iOS/Android | Sync may wait until foreground | Foreground sync is the guaranteed path; background is best-effort |
| Duplicate dose events on retry | Inflated adherence and wrong history | Client UUID + idempotent PUT + collapse on request/scheduled time |
| Local and server edits conflict | Silent data loss | Version checks and explicit conflict rules |
| Outbox exposes PHI at rest | Privacy risk | OS data protection, purge on logout, no PHI in logs |
| Token expires while offline | Sync stalls after reconnect | Refresh before sync; pause and prompt re-auth |

**Product decisions needed:**
1. Quiet hours for the family-share notification.
2. Whether the relative may see medication names or only “a dose.”
3. Whether account deletion is in v1.0 or a v1.0.x fast follow.
4. Whether family-sharing UI ships hidden in v1.0 or is removed from the build.

---

## 12. Recommended Sequence and Effort

1. Unblock tenant auth and obtain credentials.
2. Confirm the sync contract with the Ovok tester: client IDs, ETags, incremental pull, batch/transaction, rate limits.
3. Fix client config and add the patient medication scope.
4. Add the local cache, outbox, and idempotent sync path.
5. Deploy and verify the patient access policy with A/B accounts.
6. Add erasure and update the DPIA.
7. Gate family sharing off in production.
8. Ship v1.0 against staging, then production.
9. Start v1.1 with the bot caller-identity spike.
10. Ship push registration, family-share read API, then the notification bot.

**Effort estimate for one engineer, excluding external unblocks and store review:**
- v1.0 backend + offline sync: **2–4 weeks**
- v1.1 family-sharing backend: **2–3 weeks**

---

## 13. Immediate Next Actions

- [ ] Send the credential request to Actimi/Ovok.
- [ ] Send the section 14.4 sync-contract questions to the Ovok tester.
- [ ] Get a written answer on the settings endpoint and patient auth enablement.
- [x] Fix `src/lib/ovok-client.ts:13`.
- [x] Add `Medication.identifier` patient scope.
- [ ] Prototype the outbox with one offline dose event.
- [x] Define the patient access policy; test it with Patient A/B.
- [x] Add the account-deletion path and erasure procedure (live test pending).
- [ ] Gate family sharing off in production.
- [ ] Run the v1.0 staging smoke and production dry run.
- [ ] Only then start the v1.1 bot caller-identity spike.

---

## 14. Background Sync Addendum

### 14.1 Direction

- **Local-first:** every screen reads and writes the local store immediately. Local reminders never depend on the network.
- **Durable outbox:** every mutation is written to a local queue with a client-generated UUID before any network call.
- **Reconcile:** upload pending mutations, then pull server changes. The server is canonical when online; the local store is canonical when offline.
- **Background is best-effort:** sync also runs on app start, network regain, after each mutation, and after a push is opened. The app must not promise real-time sync.
- **Append-only dose events:** dose outcomes are never destructively edited; corrections create a new event or use a controlled versioned update.

### 14.2 What syncs

| Data | Direction | Conflict rule |
|---|---|---|
| Patient profile | Pull-first, then push | Last-write-wins with version check |
| Medication | Push and pull | Versioned last-write-wins; archive wins over edit |
| MedicationRequest | Push and pull | Versioned last-write-wins; stopped/paused wins over stale edit |
| MedicationAdministration | Push (append) | Idempotent by client UUID; duplicate collapses by request + scheduled time |
| Consent | Push (append/revoke) | Revocation always wins; never delete history |
| RelatedPerson / family share | v1.1, server-mediated | Server grant/revoke is authoritative |
| Device push token | Local registration | Server marks invalid tokens inactive |

### 14.3 Local store and outbox

- Use SQLite (`expo-sqlite`) for cached FHIR resources and the outbox. Keep preferences in the existing storage layer.
- Queue record: local UUID, resource type, resource ID, operation, payload, base version, attempt count, next attempt time, last error, created time.
- Exponential backoff with a cap; surface “pending sync”, “synced”, and “needs attention” states.
- Purge the local store and outbox on logout or account deletion. Rely on OS data protection at rest.

### 14.4 Server contract to confirm with Ovok

1. Can the app create resources with client-assigned IDs via `PUT /fhir/R4/<Type>/<uuid>`?
2. Are conditional create/update and `If-Match`/ETag supported?
3. Is `_lastUpdated=gt...` or `_since` supported for incremental pull?
4. Is there a batch or transaction `Bundle` endpoint, or a recommended sync endpoint?
5. Can a transaction reference a client-assigned ID created in the same bundle?
6. What are the rate limits, retry guidance, and duplicate-`PUT` behavior?
7. Is there a server-side change feed, or is polling expected?
8. How should offline-created resources reference server-created resources, and vice versa?

### 14.5 Sync workstream (v1.0)

**Tasks**
- Add a SQLite schema for FHIR cache and outbox.
- Generate client UUIDs for new resources; write locally first.
- Implement upload with idempotent `PUT` and retry/backoff.
- Implement pull by `_lastUpdated` cursor and reconcile into the cache.
- Add conflict handling per the table above.
- Add sync triggers: app foreground, network regain, after mutation, background task, push open.
- Add a visible sync status and a manual retry.
- Add tests: airplane mode, duplicate retry, reinstall pull, conflicting edit, revoked consent.

**Done when:** a user can add a medication and log doses offline, reconnect, and see exactly one copy of every event in Ovok; a reinstall pulls the same state back; no duplicate dose events exist after retries.

**Estimate:** 1–2 weeks for one engineer, plus the Ovok contract confirmation.

### 14.6 Open questions for the Ovok tester

- Which of the FHIR capabilities in section 14.4 are available today?
- Does Ovok recommend client-driven polling, a batch endpoint, or a change feed?
- What conflict behavior does Ovok expect for concurrent edits to the same resource?
- Are there server-side limits on background request volume or burst retries?
- Should family-share reads also be available offline from a last-known cache, or always require connectivity?

---

## 15. Implementation Status

**Built (not yet verified against a live tenant)**

- `server/` package with strict TypeScript, Vitest (59 tests), zero audit findings.
- FHIR HTTP client with tenant header, bearer/client-credentials auth, OperationOutcome errors, bounded retries/timeouts, `If-None-Exist` conditional create, validated next-link pagination, and a 100k-record safety cap.
- Dose schedule domain engine: daily/weekdays/custom/interval/as-needed, start/end bounds, pause history, archived plans, grace window, timezone-aware day keys, absolute/versioned reference parsing.
- Family-share domain and bots:
  - `runFamilyShareToday` returns only the shared patient's today dose statuses and keeps advanced capabilities blocked.
  - `runFamilyShareUnconfirmed` claims each dose with a conditional `Communication` before sending, covers near-midnight doses, suppresses quiet hours, deactivates invalid Expo tokens, and records delivery/claim failures.
  - `runFamilyShareUnconfirmedScan` fans out across active family shares with bounded concurrency and paging.
  - `runErasure` deletes patient-owned resources and the Patient, supports dry run, reports partial failures, and never deletes the Patient when owned-resource deletion fails.
  - `runMedicationScopeBackfill` backfills legacy `Medication` scope identifiers and reports conflicts.
- Access-policy templates for patient self-access and read-only relative access.
- Ops scripts: `verify:tenant`, `bot:family-share-today`, `bot:unconfirmed`, `bot:scan`, `bot:backfill-meds`, `bot:erase`.
- App fixes: `socialLoginClientId`, patient-scoped `Medication.identifier`, server excluded from the root TS project.

**Quality/load hardening notes**

- Notifications remain at-least-once: a stale claim can be taken over after `claimTtlMinutes` (default 15), and a crash after push but before completion may resend after the TTL.
- Run `bot:backfill-meds -- --dry-run` before enabling the patient access policy on an existing tenant.
- Ops scripts redact medication/patient labels by default; pass `--include-phi` only in a controlled environment.

**Still pending**

- Live credential verification (`npm run verify:tenant`).
- Bot registration/runtime wrapper and bot caller-identity spike.
- Push-token `Device` registration and notification permission flow.
- Offline SQLite cache/outbox and sync engine.
- Production EAS env and family-sharing production gate.
- Live Patient A/B access-policy test, conditional-create support check, and live erasure dry run.
- Tenant load test for `bot:scan` (bounded concurrency, paging, and rate limits).
