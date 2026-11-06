# Ovok integration review — fixes tracker

Review date: 2026-11-06 · Tenant `saeeds-workspace` (project `efda681b-9b90-4990-86cb-f1421cd645ea`) on `https://api.sandbox.ovok.com`.
Every finding below was reproduced against the live sandbox unless marked *code review*.

Legend: ✅ fixed · 🟡 partly fixed / needs follow-up · ⏳ open (decision or larger change)

## Critical

| # | Issue | Evidence | Status |
|---|---|---|---|
| C1 | Anyone could self-register as a Practitioner and then read **and edit** every patient's Patient, MedicationRequest, MedicationAdministration, Consent, Medication. | Stranger account read all rows and PUT another Patient (200). | ✅ Practitioner registration disabled in Console. Re-test: `403 Registration is not enabled for this project`. |
| C2 | Renaming the patient (consent screen, settings) wiped the email saved at registration — `useUpdatePatient` PUT a body with only `name` + `gender`. Hit on every new registration. | `telecom` undefined after PUT. | ✅ `useUpdatePatient` reads the stored Patient and merges. Re-tested live: email survives. |
| C3 | Sign-out left the previous user's data on the device: consent flag, primary patient id, diary, care, supply counts, React Query cache, **scheduled reminders naming their medicines**. A second user on the same phone skipped the consent screen. | *code review* — `settings.tsx` `signOut` only called `logout()`. | ✅ see "Fix details" |
| C4 | Non-idempotent `POST`s were retried after timeouts / 5xx (uncommitted `ovok-fetch.ts` retry loop × `fhir-repository.ts` `withRetry` = up to 8 sends). A timeout after the server saved creates a duplicate Medication / MedicationRequest. | *code review* | ✅ see "Fix details" |
| C5 | `session-ses_ea52.md` is committed with an account password and an old client secret. | `git ls-files` | ✅ History rewritten (filter-repo) and force-pushed to the **public** GitHub repo; 0 hits in `git log --all -p`. Owner: ask GitHub Support to purge cached commit `81d8a59` — [S-02](OVOK_REMAINING_SPECS.md#s-02-purge-secrets-from-git-history). |
| C7 | **In-app privacy notice says data is "100% local, no cloud, no account"** — false for live (Ovok) builds. GDPR transparency + App Store review risk. | `privacyWhatBody` / `privacyWhereBody` in `src/lib/takt/locales/*.ts` | ⏳ Corrected wording drafted in [S-09](OVOK_REMAINING_SPECS.md#s-09-demographics-minimisation); needs Actimi legal sign-off before shipping. |
| C8 | Dose-log query used `_sort=-effectiveDateTime` → Ovok **400 Unknown search parameter**; Today/History had no dose data against the live backend. | Live sandbox, found during S-04 | ✅ Uses `effective-time` (`use-dose-events.ts`, mock server). |
| C6 | Client secret for client `a823f2d1…` was pasted in chat. | — | ⏭ Rotation skipped by owner; secret never committed, only in `server/.env` (`verify-tenant` → ok). |

## Data model / defaults

Open items (⏳) each have a spec in [`OVOK_REMAINING_SPECS.md`](OVOK_REMAINING_SPECS.md): D5→S-04, D7→S-05, D12→S-06, D6→S-07, D8→S-08, D9→S-09, D10→S-10, D11→S-11. Admin-script typecheck → S-03 ✅.

| # | Issue | Status |
|---|---|---|
| D1 | `dispenseRequest.quantity.unit` hard-coded `'tablets'` (wrong for ml, puffs, drops…). | ✅ Uses the plan's `dosageUnit`, falls back to `tablets`. |
| D2 | `usePrimaryPatient` picked "most recently updated Patient I can see" instead of the logged-in profile. Safe only while patients are isolated. | ✅ Prefers the login profile when it is a Patient. |
| D3 | Patient timezone never stored; server bots fall back to `TAKT_DEFAULT_TIMEZONE` (UTC) — the server already reads `https://actimi.com/fhir/takt/patient-timezone`. | ✅ Written on Patient create / rename. |
| D4 | Register screen did not enforce the server's 12-character password minimum (users only saw a server error). | ✅ Client-side check + EN/DE message. |
| D5 | Supply count lives only in AsyncStorage — lost on reinstall, invisible to clinicians. | ✅ S-04: server anchor `{count, at}` on the MedicationRequest, remaining derived from the dose log; local store is now a synced cache. Live-tested 8/8. |
| D6 | Medications are free text (`code.text`) — no RxNorm / ATC / PZN coding, so no interaction checks or dedup. | 🟡 Decided ATC (BfArM German version); waiting on the data file + licence check — S-07. |
| D7 | Per-intake dose stored as extension string `"2 tablets"` instead of `dosageInstruction.doseAndRate.doseQuantity`. | ✅ S-05: `doseAndRate.doseQuantity` written (UCUM for mg/ug/g/mL), legacy extension still written for one release; reader prefers the standard field. Live: both stored. **Remove the extension write in the release after next.** |
| D8 | Pause history and appearance are JSON strings inside extensions — not searchable or validatable server-side. | ✅ S-08 phase 1: structured `pause-period` / `medication-appearance` written alongside the legacy strings; app + server read both; backfill bot ready. Phase 2 (drop legacy) after old builds retire. |
| D9 | `gender: 'unknown'`, no `birthDate` collected. | ✅ Stay minimal: no `gender`/`birthDate`; `'unknown'` no longer written — S-09. |
| D10 | Device clock used for `authoredOn`, consent `dateTime`, dose `effectiveDateTime`. | ✅ S-10: kept by design (offline-first); consent audit shows the server's `meta.lastUpdated` as "Saved by server"; Today warns when the phone clock is >5 min off (from Ovok's `Date` header, native only); a "taken" time can't be in the future. Live: consent with device time 2020 → server stamp 2026. |
| D11 | Extension URLs are on `actimi.com` with no published StructureDefinitions. | 🟡 Keep `actimi.com` namespace; needs domain owner's approval to host profiles — S-11. |
| D12 | No email verification — registration returns tokens immediately. | 🟡 Ovok supports it; blocked on SMTP setup in the Ovok Console — S-06. |

## Fix details

**C3 — sign-out / user switch** (`src/lib/takt/session-reset.ts`)
- `clearUserLocalState()`: cancels all scheduled notifications + alarms, clears the React Query cache, removes every `takt:*` AsyncStorage key except an explicit device-preference allow-list (theme, locale, text scale, reminder prefs, permission/diagnostic keys, QA tool state, mock store). Deny-by-default so new user-scoped keys are cleared automatically.
- Called from sign-out, and on sign-in / registration when the profile differs from the last one on the device.
- After sign-in the consent flag is restored from the server's active `Consent`, so the same user is not re-prompted.

**C4 — retries** (`src/lib/ovok-fetch.ts`, `src/lib/takt/fhir-repository.ts`)
- `ovokFetch` retries only idempotent requests: `GET`/`HEAD`/`PUT`/`DELETE`, or a `POST` carrying `If-None-Exist`.
- Removed the second retry layer in `fhir-repository.ts`; `ovokFetch` already honours `Retry-After`.

## Verification (2026-11-06)
- `npm test`: 9 files / 74 tests pass, incl. new `src/lib/ovok-fetch.test.ts` (5 retry-rule cases). `vitest.config.ts` now also includes `src/lib/*.test.ts`.
- `tsc --noEmit`: **0 errors** (S-03 fixed the 8 in `scripts/ovok-*-default-practitioner-policy.ts`).
- After S-03/S-05/S-10: `npm test` 9 files / 80 tests pass.
- `eslint` on touched files: 0 errors; remaining warnings are pre-existing (unused vars in settings, refs in reminders).
- Live sandbox: rename keeps email + writes timezone; consent lookup (`Consent?patient=…&_sort=-date&_count=1`) returns latest status, including after a withdraw; practitioner self-registration → 403.

## How to re-test
Live scripts (not committed): register/login + field checks, and app write-path replay — see the session scratchpad `e2e-auth.mjs`, `e2e-data.mjs`.

## Deferred clean-ups (release after next)
- S-05: stop writing the `takt/dosage-quantity` extension string.
- S-08: stop writing `takt/pause-history` and `takt/appearance`; run `npm run bot:backfill-structured -- --confirm --drop-legacy`.
