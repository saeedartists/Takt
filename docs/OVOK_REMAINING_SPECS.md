# Remaining-issue specs (Ovok review)

Written 2026-11-06. One spec per open item in [`OVOK_REVIEW_FIXES.md`](OVOK_REVIEW_FIXES.md), in the order to do them.
Tenant for every live check: `saeeds-workspace` on `https://api.sandbox.ovok.com` (server creds in `server/.env`, verified with `server/scripts/verify-tenant.ts`).

| Spec | Issue | Kind | Effort | Blocked on |
|---|---|---|---|---|
| [S-01](#s-01-rotate-the-admin-client-secret) | C6 client secret exposed in chat | Ops | 15 min | ⏭ Skipped by owner |
| [S-02](#s-02-purge-secrets-from-git-history) | C5 password + old secret in git history | Ops | 30 min | ✅ Done |
| ✅ [S-03](#s-03-admin-scripts-typecheck) | 8 `tsc` errors in admin scripts | Code | 30 min | — |
| ✅ [S-04](#s-04-server-side-supply-count) | D5 supply count only on device | Code | 1–2 days | — |
| ✅ [S-05](#s-05-standard-dose-quantity) | D7 dose stored as extension string | Code | 0.5 day | — |
| [S-06](#s-06-email-verification) | D12 no email verification | Investigation → code | 0.5–2 days | SMTP not configured |
| [S-07](#s-07-coded-medications) | D6 free-text medications | Product + code | 3–5 days | Decided: ATC — needs data source |
| ✅ [S-08](#s-08-structured-extensions) | D8 JSON strings in extensions | Code | 1 day | — |
| [S-09](#s-09-demographics-minimisation) | D9 gender `unknown`, no birthDate | Decision + docs | 0.5 day | ✅ Code done · privacy copy needs legal |
| ✅ [S-10](#s-10-device-clock-timestamps) | D10 device-clock timestamps | Docs + small code | 0.5 day | — |
| [S-11](#s-11-extension-namespace-and-profiles) | D11 `actimi.com` URLs, no profiles | Decision + docs | 1 day | Owner (Actimi) approval |

**Rules for every spec**
- Old data keeps working: readers accept the old and the new shape until a migration has run.
- Every spec ends with a live check against the sandbox tenant and, where there is logic, one unit test under `src/lib/**` (vitest).
- When a spec lands, flip its row in `OVOK_REVIEW_FIXES.md`.

---

## S-01 Rotate the admin client secret

> **Status:** ⏭ Skipped (owner decision, 2026-11-06). The secret was never committed (`git log --all -p` has no hit) and lives only in `server/.env`. Residual risk: it is in a chat transcript and has Admin rights — revisit before production.

**Problem.** The secret of admin client `takt` (`a823f2d1-…`) was pasted in a chat transcript. It is still valid (client_credentials issued a token on 2026-11-06). It has Admin rights on the project, so it can read and write every patient.

**Steps**
1. Ovok Console → project *Saeed's workspace* → Applications → `takt` → regenerate secret.
2. Put the new value in `server/.env` → `OVOK_CLIENT_SECRET` (the only place it may live; gitignored).
3. Same value in any deployed server's secret store (CI / hosting env), never in `eas.json` or `EXPO_PUBLIC_*`.
4. Consider a second, non-admin client for the bots with only the access they need (Communication create, Patient / MedicationRequest / MedicationAdministration read) — least privilege.

**Acceptance**
- `cd server && npx tsx scripts/verify-tenant.ts` → `"ok": true` with the new secret.
- The old secret returns `invalid_client` at `POST /oauth2/token`.
- `git grep -n <first 8 chars of the secret>` → no hits.

---

## S-02 Purge secrets from git history

> **Status:** ✅ Done 2026-11-06. The repo turned out to be **public** (`github.com/saeedartists/Takt`) and the file was pushed in `81d8a59`.
> - `git filter-repo --invert-paths --path session-ses_ea52.md` on all local refs; uncommitted work stashed and restored; backups in the session scratchpad (`s02-backup/`: all-refs bundle, working-tree patch, untracked tar).
> - `git log --all -p` → 0 hits for the password, the old secret and the file name. Force-pushed `main` with `--force-with-lease` pinned to the old tip `145d860` (first attempt dropped by GitHub mid-upload; the retry sent only the 2 changed commits). Verified: `origin/main` and `origin/gh-pages` have 0 hits; local reflog expired + `gc --prune=now`.
> - New hashes: `81d8a59 → 2d67244`, `145d860 → 18cf3a9`.
> - **Still to do (owner):** the old commit is **still reachable on GitHub by SHA** (`gh api repos/saeedartists/Takt/commits/81d8a59` returns it, checked 2026-11-06) until GitHub purges it — open a GitHub Support request "remove cached views / sensitive data" for `saeedartists/Takt` commit `81d8a59`. Disable the old `practice-stdi` client `82876711-…` in its Ovok project. Anyone with an old clone must re-clone.

**Problem.** `session-ses_ea52.md` (account password, old client `82876711-…` secret) is untracked now but still in history. The password has been changed; the old client belongs to the abandoned `practice-stdi` tenant.

**Decision first.** If the repo has never been pushed anywhere others can read, rotating (done) is enough — skip the rewrite. If it is on GitHub / shared, rewrite.

**Steps (if rewriting)**
1. `git remote -v` — note every remote; tell collaborators to stop pushing.
2. `brew install git-filter-repo`, then on a fresh mirror clone: `git filter-repo --path session-ses_ea52.md --invert-paths`.
3. Scan the rest of history: `git log -p --all | grep -nE '<old password>|<old secret prefix>|<current secret prefix>'` (values from your password manager, never written into the repo) → must be empty after the rewrite.
4. Force-push all branches and tags; collaborators re-clone.
5. Disable/delete client `82876711-…` in the old `practice-stdi` project.

**Acceptance.** The step 3 grep on the pushed repo returns nothing; `.gitignore` keeps `session-ses_*.md`.

---

## S-03 Admin scripts typecheck

> **Status:** ✅ Done 2026-11-06

**Problem.** `npx tsc --noEmit` reports 8 errors, all in `scripts/ovok-create-default-practitioner-policy.ts` (6) and `scripts/ovok-set-default-practitioner-policy.ts` (2), from commit `145d860`. A red typecheck hides new errors.

**Cause.** The small FHIR helper's generics are unconstrained: `create<T>(resource: T)` / `update<T>(resource: T)` read `resource.resourceType` and `resource.id` on a bare `T`. And `tokenUrl` / `clientId` stay `string | undefined` when passed to `clientCredentialsTokenProvider`, because the earlier guard checks a different variable.

**Change**
- Constrain: `type Resource = { resourceType: string; id?: string }`, then `create<T extends Resource>(…)` / `update<T extends Resource>(…)` in both scripts.
- After the "no auth path" early return, build the provider inside `if (tokenUrl && clientId && clientSecret)` so the types narrow.
- No behaviour change.

**Acceptance.** `npx tsc --noEmit` → 0 errors. `npm test` still green. The set-policy script in list mode against the sandbox → lists AccessPolicies.

---

## S-04 Server-side supply count

> **Status:** ✅ Done 2026-11-06 (anchor + derive, as designed).
> - `src/lib/takt/supply-anchor.ts` (pure, 7 unit tests): `takt/supply-anchor` complex extension `{count, at}` on the MedicationRequest; `remainingSupply` = count − completed doses of that plan after `at` × per-intake units.
> - Writes: plan create/update re-anchor with the live count (no extra request); refill in the action sheet calls `writeSupplyAnchor` (GET latest → PUT with `If-Match`, one retry on 412) **before** touching the local count, so an offline refill fails visibly instead of being undone by the next sync.
> - Read: `syncSupplyFromServer` in `app/(tabs)/_layout.tsx` refreshes the local cache (`syncSupplyCount` — no refill semantics, no nudges) once plans + dose log are loaded and no mutation is in flight; it also uploads pre-S-04 local counts as anchors once. The auto pause/archive effect waits for this sync.
> - Screens unchanged: they keep reading the local cache, which is now a mirror of the server.
> - Live sandbox (`e2e-s04.ts`, 8/8): anchor round-trips; "new device" 30 − 2×2 = 26 with a skip ignored; undo → 28; refill PUT with If-Match → 200, stale If-Match → **412**; post-refill 58, next dose 56.
> - Known ceiling: derivation uses the loaded dose page (`_count=500`).
> - **Found while testing:** the app's dose-log query `_sort=-effectiveDateTime` returns **400** on Ovok (correct search param: `effective-time`) — fixed in `use-dose-events.ts` and the mock server. This broke Today/History against the live backend.

**Problem.** The pill count lives only in AsyncStorage (`src/lib/takt/supply-tracker.ts`, key `takt:supply-tracker:v1`). Reinstall, a second device or sign-out loses it; clinicians and server bots never see it. `MedicationRequest.dispenseRequest.quantity` is written only at create/edit and goes stale after the first dose (`app/(tabs)/_layout.tsx:108` says so).

**Design — anchor + derive (no per-dose writes)**
- Anchor on the MedicationRequest, written only when the user sets or refills the count:
  `extension takt/supply-anchor` (complex): `count` (valueDecimal), `at` (valueDateTime), `unit` (valueCode = plan `dosageUnit`).
- Remaining = `anchor.count − Σ dose quantity` over `MedicationAdministration` with `status = completed`, `request = this MedicationRequest`, `effectiveDateTime > anchor.at`. Dose quantity = plan dose (S-05), default 1.
- Pure function `remainingSupply(anchor, administrations, dosePerIntake)` in `src/lib/takt/supply.ts`, mirrored in `server/src/domain/` — no network inside.
- AsyncStorage stays as offline cache + nudge state (`lowSupplyNudgedAt`, `nudgeId`), keyed by MedicationRequest id. The server-derived value wins whenever it is reachable.
- Why not decrement per dose: one PUT per dose, version conflicts across devices, and undo needs a second write. Deriving from the dose log is consistent by construction, and undo (DELETE of the administration) restores supply automatically.

**Changes**
- `use-takt-mutations.ts`: create/update plan writes the anchor when `supplyCount` is set; refill writes a new anchor (PUT with `If-Match: W/"<versionId>"`).
- `use-medication-plans.ts`: read the anchor; `supplyCount` = `remainingSupply(...)` over the plan's administrations (already fetched for history).
- `supply-tracker.ts`: `deductSupply` / `restoreSupply` become cache updates only; snapshot readers use the computed value.
- Follow-up: low-supply reminder can move to a server bot.

**Migration.** First launch after release: for each plan with a local count and no anchor, write anchor `{count: localCount, at: now}`. Idempotent (skip if an anchor exists).

**Acceptance**
- Unit `remainingSupply`: no anchor → undefined; anchor 30 + two completed doses of 2 → 26; `not-done` ignored; dose before `anchor.at` ignored.
- Live: set 30 on device A, take a dose, sign in on device B (or wipe storage) → B shows 29.
- Sign-out wipe (C3) then sign-in → count is back.

---

## S-05 Standard dose quantity

> **Status:** ✅ Done 2026-11-06 — drop the legacy extension write in the release after next

**Problem.** The per-intake amount is written as extension `takt/dosage-quantity` = `"2 tablets"` (`planExtras` in `use-takt-mutations.ts`) and parsed back by splitting the string (`readDosage`, `use-medication-plans.ts:91`). Other FHIR consumers can't read it; FHIR has `dosageInstruction[].doseAndRate[].doseQuantity` for exactly this.

**Design**
- Write `dosageInstruction[0].doseAndRate = [{ doseQuantity: { value, unit, system?, code? } }]`.
  UCUM (`http://unitsofmeasure.org`) codes for `mg`, `mcg`/`µg` → `ug`, `g`, `ml` → `mL`. Countable forms (`tablets, capsules, drops, puffs, sprays, units`) use `unit` only.
- Keep writing the extension for one release (older app builds read it), then stop.
- Read: prefer `doseAndRate[0].doseQuantity`, fall back to the extension.

**Changes.** `buildDosage` adds the dose; `readDosage` prefers the standard field; a small `toUcum(unit)` map next to `MedicationUnit` in `src/lib/takt/types.ts`.

**Migration.** None needed (read fallback); any plan edit writes the new field.

**Acceptance**
- Unit: `readDosage` with only extension / only doseAndRate / both (doseAndRate wins).
- Live: create a plan with 2 tablets → both fields present; read back shows 2 tablets.
- `scripts/verify-form-model.ts` still passes.

---

## S-06 Email verification

> **Status:** Ovok supports verification, but **SMTP is not configured** in the project yet. Next: configure SMTP in the Ovok Console → enable verification → then implement Option A (app handles the verify step). Option B is dropped.

**Problem.** `POST /auth/tenant/Patient/register` returns tokens immediately; nobody proves they own the email. Someone can register with another person's address, and password-reset mail then goes to that person.

**Investigation first (0.5 day)**
- `@ovok/core` 0.4.42 and its conformance list expose **no** verify-email endpoint (checked `dist/conformance/api-requirements.js`).
- Check the Ovok Console project settings and ask Ovok support whether tenant registration can require verification before login.

**Option A — Ovok supports it (preferred).** Enable it. App: `register-screen.tsx` handles the new `nextStep` (same shape as the existing invitation branch) with a "check your inbox" state; `auth-errors.ts` maps the "unverified" sign-in error to a resend prompt.

**Option B — Ovok does not.** Takt server:
- On register, send a signed one-time link (HMAC, 24 h expiry) by email.
- Store `extension takt/email-verified-at` on the Patient.
- Gate sensitive actions (family-sharing invite, data export) until verified; own-data use stays allowed so onboarding isn't blocked.
- Weaker than A (account exists before verification) — document that.

**Acceptance.** Gated action blocked until the link is used; reused and expired links rejected; resend rate-limited.

---

## S-07 Coded medications

> **Status:** Decision 2026-11-06: **ATC**. Licensing note before implementing: the WHO ATC/DDD index is copyrighted and its commercial reuse needs WHO permission; the **BfArM "Amtliche Fassung des ATC-Index"** (German official version) is the source to use for DE — confirm its terms of use with Actimi before bundling it. Implementation can start once the data file is in hand (CSV/XLS from BfArM).

**Problem.** `Medication.code` is free text only (`{ text: 'Ibuprofen' }`). No interaction checks, no dedup ("Ibuprofen" vs "ibuprofen 400"), no clinical interoperability.

**Decision (product).** UI is DE/EN, so:
- **ATC** (WHO; BfArM publishes the German ATC list yearly) — substance level, fine for dedup / interactions. **Recommended now.**
- **PZN** — exact German package; licensed (ABDA). Only if barcode scanning becomes a feature.
- RxNorm — US only, not a fit.

**Design (ATC)**
- Compact substance list (ATC code + DE/EN name) bundled as JSON, or served by the Takt server `GET /medications/search?q=` if the size hurts the bundle.
- Name field becomes search-as-you-type; free text still allowed (no match → text only).
- Write `Medication.code = { coding: [{ system: 'http://www.whocc.no/atc', code, display }], text }`.
- Never block a save on missing coding.

**Changes.** `app/medications/new.tsx` and the edit screen (picker), `src/lib/takt/medication-form.ts` (optional `atc` on the form value), create/update mutations write the coding; display keeps using `code.text`.

**Acceptance.** Picking Ibuprofen writes `M01AE01`; an unknown name saves text only; existing plans untouched; search works offline if bundled.

---

## S-08 Structured extensions

> **Status:** ✅ Done 2026-11-06 (phase 1 of 2).
> - New URLs (frozen namespace per S-11): `takt/pause-period` (MedicationRequest, one complex `{start, end?}` per pause) and `takt/medication-appearance` (Medication, `{shape (valueCode), color}`). New URLs instead of reusing the old ones: one extension can't carry both a `valueString` and sub-extensions.
> - App: `src/lib/takt/structured-extensions.ts` replaces the two duplicate private parsers (`use-medication-plans.ts`, `use-takt-mutations.ts`); readers prefer structured, fall back to legacy; writers emit **both** for one release. Malformed entries are dropped per period instead of wiping the whole history. 7 unit tests.
> - Server: mirror in `server/src/domain/structured-extensions.ts`; `schedule.ts` (family-share bots) now reads both shapes.
> - Backfill: `npm run bot:backfill-structured` (dry-run default; `--confirm` writes; `--drop-legacy` = phase 2). 4 tests (dry-run, phase 1, phase 2, idempotent). Live dry-run on `saeeds-workspace`: 3 requests to update, 10 unchanged, 0 failed.
> - Live sandbox (`e2e-s08.ts`, 6/6): Ovok accepts and returns both complex extensions intact; legacy strings still present for old builds.
> - **Phase 2 (later, when no pre-S-08 build is in use):** stop writing `takt/pause-history` / `takt/appearance` (`withPauseHistory`, `appearanceExtensions`), then `npm run bot:backfill-structured -- --confirm --drop-legacy`.

**Problem.** `takt/pause-history` (JSON array string on MedicationRequest) and `takt/appearance` (JSON object string on Medication) can't be validated or searched server-side, and a malformed string silently becomes `[]` (`readPauseHistory`).

**Design — complex extensions**
- Pause: one `takt/pause` extension per period with sub-extensions `start` (valueDateTime) and optional `end` (valueDateTime).
- Appearance: `takt/appearance` with sub-extensions `shape` (valueCode) and `color` (valueString).

**Order (old app builds and the server must keep working)**
1. Ship readers that accept both shapes — app (`use-medication-plans.ts:37,71`, `use-takt-mutations.ts:261`) **and** server (`server/src/domain/schedule.ts:50`).
2. Next release writes only the new shape.
3. One-off backfill in `server/scripts/` (pattern: `backfill-medication-scope.ts`) rewrites the rest; dry-run first.

**Acceptance.** Unit: both shapes parse to the same `PausePeriod[]` / appearance; schedule tests unchanged; backfill dry-run prints counts and a second real run changes nothing.

---

## S-09 Demographics minimisation

> **Status:** ✅ Code done 2026-11-06 (decision: stay minimal). Patient create no longer writes `gender: 'unknown'`; update keeps whatever is stored and asserts nothing.
>
> **⚠ Found while doing this — the in-app privacy notice is wrong for the live backend.** `privacyWhatBody` / `privacyWhereBody` (EN + DE in `src/lib/takt/locales/*.ts`) say data is stored "100% locally… no cloud servers… no user account". In live mode the account, Patient (name, email, timezone), plans, dose log and Consent are stored on Ovok. This needs Actimi's legal sign-off; proposed wording below, **not shipped**.

**Problem.** Patients are stored with `gender: 'unknown'` and no `birthDate`. That is defensible data minimisation but undocumented, and `'unknown'` asserts a value rather than "not collected".

**Decision.** Stay minimal (GDPR Art. 5(1)(c)) unless a feature needs age (age-based dose warnings, children's plans).

**Changes**
- Privacy notice and `docs/ARCHITECTURE.md`: list exactly what the Patient holds (name, email, timezone) and why.
- Create path: omit `gender` instead of writing `'unknown'` (`useEnsurePatient`, `useUpdatePatient` fallback).
- If age is ever needed: birth year only (`birthDate: 'YYYY'` — FHIR allows year precision).

**Acceptance.** New Patients have no `gender`; existing ones untouched; privacy notice matches the stored fields.

**Proposed privacy wording (for Actimi legal review — live/Ovok builds)**

- *What is stored* — "Your account (name, email address, time zone), your medication plans (name, form, strength, schedule, dose amount), the doses you confirm or skip, and your consent. Personal notes and the pill counter stay on your phone. We do not collect your gender or date of birth."
- *Where data is stored* — "Your account and health data are stored in Takt's health-data backend operated by Ovok (<hosting location / data-processing agreement — to be filled in by Actimi>). A copy is kept on your phone so the app works offline. Signing out removes your data and scheduled reminders from the phone."
- Keep the current "100% local" text only for the mock/offline build, or remove it.

---

## S-10 Device-clock timestamps

> **Status:** ✅ Done 2026-11-06

**Problem.** `authoredOn`, Consent `dateTime`, dose `effectiveDateTime` and `request-created-at` come from the phone clock. A wrong clock writes wrong history.

**Position.** Correct for an offline-first app — the dose time is when the user says they took it. The trusted audit time is the server's `meta.lastUpdated` plus resource history. Say this when asked.

**Changes**
- Consent / audit views show `meta.lastUpdated` as "recorded at" next to the user-facing time.
- Skew guard in `ovokFetch`: compare the response `Date` header with `Date.now()`; if |skew| > 5 min, store it and show one line on Today ("Your phone's clock is off — dose times may be wrong").
- Form level: reject a dose time more than 24 h in the future.

**Acceptance.** Unit: skew from a `Date` header; live: consent view shows both times.

---

## S-11 Extension namespace and profiles

> **Status:** Owner is Actimi (employer). Recommendation: keep `https://actimi.com/fhir/takt/` (company domain is the right namespace) and ask the domain owner to approve hosting the StructureDefinitions there. Treat the URLs as frozen meanwhile; S-04 and S-08 may proceed using this namespace.

**Problem.** Every custom URL is under `https://actimi.com/fhir/takt/…` (`src/lib/takt/constants.ts`, duplicated in `server/src/domain/constants.ts`). Nothing resolves there and there are no StructureDefinitions.

**Decision — before S-04/S-05/S-08 add URLs.** Confirm Actimi owns `actimi.com` and will host `/fhir/takt/`. Changing URLs later means migrating every stored resource.

**Changes**
- One source of truth for the URL list, imported by app and server (the two copies already drift: `patientTimezone` had to be added on the app side on 2026-11-06).
- StructureDefinitions per extension (FSH + SUSHI) in `docs/fhir/`; publish static JSON at the canonical URLs.
- Optional: load them into the Ovok project so writes are validated.

**Acceptance.** Every `TAKT_EXT` URL resolves or is documented as reserved; app and server share one list; a malformed extension is rejected once profiles are loaded.
