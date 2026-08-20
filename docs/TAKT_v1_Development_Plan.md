# Takt v1.0 — Comprehensive Development Plan (Production-Ready)

**Product:** Takt — medication reminder and adherence tracker  
**Platform target:** Ovok Builder + Actimi Appstore (internal distribution first)  
**Version:** v1.0 (MUST scope only)  
**Document purpose:** End-to-end implementation blueprint with phase gates, engineering tasks, and strict Definition of Done criteria.

---

## 1) Executive Summary

Takt v1.0 is a **calm, private, non-medical-device** medication adherence app. It must reliably:

1. Let users define medication schedules.
2. Trigger reminders at local dose times.
3. Record dose outcomes (taken/skipped/missed).
4. Show a trustworthy 14-day adherence history.
5. Export a one-page doctor report PDF.
6. Operate under GDPR Article 9 explicit consent and strict data minimization.

This plan enforces three hard guardrails:

- **Scope discipline:** Build only v1.0 MUST items. No interaction warnings, no dose recommendations, no risk scores, no sensor-derived vitals.
- **Regulatory boundary:** Reminders/logging/reporting only; no decision support behavior.
- **Reliability-first architecture:** Notification capability must pass the **Spike Risk Gate** before full build.

---

## 2) Non-Negotiable Scope and Boundaries

## 2.1 MUST for v1.0

- iOS + Android delivery from one codebase.
- Add, edit, pause, archive medication.
- Schedule cadence: daily, weekdays, multiple times/day.
- Reliable local reminders at dose time.
- Mark dose as taken/skipped/snooze.
- Today screen as launch destination.
- 14-day history + adherence percentage.
- One-page doctor report PDF.
- German + English support.
- Explicit Article 9 consent at first run.
- In-app privacy notice, imprint, non-device disclaimer.

## 2.2 WON’T by decision (must be enforced by product + engineering)

- Drug interaction warnings.
- Dose recommendations.
- Risk scoring/grading.
- Sensor-derived vital measurement.
- Symptom checking/triage.
- Advertising/data monetization.
- Third-party analytics on health screens.

## 2.3 Technical policy constraints

- Data model on Ovok FHIR (Patient, Medication, MedicationRequest, MedicationAdministration, Consent).
- Schedule semantics use **local wall-clock time** (timezone-aware behavior without schedule drift).
- Dose state machine with **4-hour grace window**.
- Accessibility floor: body text >= 17 pt equivalent, large touch targets, non-color status semantics.
- One-page PDF report format.

---

## 3) Architecture and Resource Mapping

## 3.1 FHIR mapping

| Product concept | FHIR resource | Notes |
|---|---|---|
| User profile | `Patient` | One patient record per account/project tenant scope |
| Medication definition | `Medication` | User-entered name/form/strength; no drug DB dependency |
| Schedule/cadence | `MedicationRequest` | `dosageInstruction.timing` carries schedule |
| Dose event | `MedicationAdministration` | One record per dose outcome (`completed` / `not-done`) |
| Consent record | `Consent` | Explicit Article 9 consent + revocation |

## 3.2 Dose event modeling standard

- `MedicationAdministration.status`:
  - `completed` => taken
  - `not-done` => skipped/missed (distinguished via `statusReason` + extension)
- Required references:
  - `medicationReference -> Medication/<id>`
  - `subject -> Patient/<id>`
  - `request -> MedicationRequest/<id>`
- Extensions:
  - `scheduled-time` (local intended dose time)
  - `dose-outcome` (taken/skipped/missed/snoozed) if needed for explicit analytics clarity

## 3.3 Core app route map (all pages/tabs)

- `/consent` (first-run legal + consent + notification permission prompt)
- `/(tabs)/today` (launch surface)
- `/(tabs)/medications` (list + pause/archive controls)
- `/medications/new` (add form)
- `/medications/[id]/edit` (edit form)
- `/(tabs)/history` (14-day bars + missed doses)
- `/report` (doctor PDF generation and preview/export)
- `/(tabs)/settings` (language, legal, preferences)
- `/settings/privacy`
- `/settings/imprint`

---

## 4) Delivery Phases and Gates

## Phase 0 — Scope Lock, Governance, and Backlog Freeze

### Detailed To-Dos

- Convert product brief MUST/WON’T into engineering acceptance checklist.
- Add **Scope Guard tests/checklist** to PR template:
  - “No interaction warning logic introduced”
  - “No advice/risk scoring text introduced”
- Define release roles: Product owner, Tech lead, QA lead, Compliance reviewer.
- Convert this document into tracked Jira/Linear epics and story points.
- Freeze v1.0 backlog; move fast-follow features (family sharing, refill, diary, CMS education) into v1.1 board.

### Verification & Definition of Done

- MUST/WON’T checklist exists and is signed by Product + Engineering.
- Backlog includes only v1.0 MUST tickets.
- Any out-of-scope ticket tagged `v1.1` and excluded from sprint burn-down.

---

## Phase 1 — Risk Gate Spike (Foundational Blocker)

> **This phase is mandatory before full build.**

### Detailed To-Dos

1. **Builder output viability test**
   - Verify whether pipeline yields deployable app bundle suitable for native packaging path.
   - Validate static assets/runtime can be embedded for reliable app behavior.
2. **Notification reliability spike**
   - Implement minimal schedule test: one immediate + one delayed + one overnight reminder.
   - Test both iOS and Android with app closed and device locked.
   - Validate Android exact alarm configuration path.
3. **Reboot resiliency test**
   - Restart device and confirm scheduled reminders are re-registered correctly.
4. **Offline behavior test**
   - Ensure reminders still fire with network off.
5. **Spike report**
   - Document constraints, unresolved issues, and go/no-go recommendation.

### Verification & Definition of Done

- Demonstrated reminder firing on iOS + Android overnight with app closed.
- Reminder timestamps remain within tolerance of scheduled time.
- Reboot test passes (no notification queue loss without recovery).
- Written go/no-go signed by Tech lead + Product.
- If failed: execute fallback architecture decision before entering Phase 2.

---

## Phase 2 — Environment, Project Configuration, and Foundations

### Detailed To-Dos

- Configure environments:
  - `dev` (mock + integration)
  - `staging` (real Ovok tenant)
  - `prod` (Actimi distribution)
- Confirm Ovok project settings and auth posture for intended login path.
- Set default locale behavior to **English-first UI** while preserving full DE localization capability.
- Implement design tokens for Takt visual system:
  - amber as primary action,
  - green only for taken confirmation,
  - red only for missed history semantics,
  - large typography floor.
- Implement shared app primitives:
  - page shell, section header, dose row, medication card, adherence bar, legal page template, primary CTA.
- Establish error handling framework with user-safe health-context copy.

### Verification & Definition of Done

- Environment matrix documented and working.
- English is default first-run language.
- Color/typography tokens enforce accessibility baseline.
- Shared components render correctly in light/dark variants.
- Standard loading/empty/error/success states available for all data-backed screens.

---

## Phase 3 — FHIR Data Contracts and API Layer

### Detailed To-Dos

- Define typed contracts for each resource:
  - `Patient`, `Medication`, `MedicationRequest`, `MedicationAdministration`, `Consent`.
- Implement repository/service layer (no direct FHIR fetch calls from UI components).
- Build CRUD functions:
  - Medication create/update/archive
  - MedicationRequest create/update/pause
  - MedicationAdministration create for dose events
  - Consent create/revoke
- Implement id/reference integrity:
  - Server-generated IDs persisted and reused for downstream references.
- Add validation helpers for:
  - required references,
  - schedule fields,
  - status enums,
  - local datetime formats.
- Build query hooks:
  - active medications,
  - today schedule events,
  - 14-day administrations,
  - consent status.

### Verification & Definition of Done

- All resources validate against FHIR structure.
- All create flows return and persist valid IDs.
- Relationship graph integrity test passes:
  - every MedicationRequest links to Medication + Patient,
  - every MedicationAdministration links to MedicationRequest + Medication + Patient.
- API layer includes retry and user-facing OperationOutcome parsing.
- No UI component imports low-level HTTP directly.

---

## Phase 4 — Schedule Engine and Dose State Machine

### Detailed To-Dos

- Implement schedule generator from MedicationRequest timing rules:
  - daily
  - weekday-specific
  - multiple times/day
- Build deterministic state machine:
  - `scheduled -> due -> taken|skipped|missed`
- Apply fixed grace window: **4 hours**.
- Implement behavior rules:
  - taken within grace counts as on-schedule
  - after grace closes, today screen disallows retroactive mark-taken
  - correction allowed in history flow with explicit audit metadata
- Implement 10-minute undo window after marking taken.
- Handle edge cases:
  - timezone changes (wall-clock semantics)
  - DST transitions
  - med added mid-day (future doses only)
  - paused meds excluded from denominator
  - simultaneous doses grouped by time heading but stored as separate dose events

### Verification & Definition of Done

- Unit tests for every transition and forbidden transition.
- Edge-case simulation suite passes for timezone + DST + pause windows.
- Grace-window lock behavior verified in UI and persisted data.
- Adherence denominator excludes paused intervals.
- Parallel-dose grouping verified without data coalescence errors.

---

## Phase 5 — Native Reminder Scheduling and Reliability

### Detailed To-Dos

- Implement notification permissions flow at first-run with clear value messaging.
- Schedule local notifications per upcoming dose event.
- Build resync routine:
  - app launch,
  - app resume,
  - schedule changes,
  - medication pause/archive,
  - timezone change.
- Create reminder action handling:
  - open app into Today context for specific dose.
- Implement snooze behavior for v1.0 policy.
- Add exact-alarm support path for Android where needed.
- Build observability logs for reminder scheduling, cancellation, and dispatch diagnostics.

### Verification & Definition of Done

- Reminders fire reliably with app closed and offline.
- Schedule edits immediately update pending notifications.
- Paused/archived medications have no active notifications.
- Reminder tap deep-links to relevant Today item.
- Overnight reliability test pass documented.

---

## Phase 6 — UI Information Architecture and Navigation (English-First)

### Detailed To-Dos

- Implement final tab structure:
  - Today / Medications / History / Settings
- Ensure all required pages are reachable from tabs or stack routes.
- Make **English-first copy** complete for all labels, errors, toasts, and legal prompts.
- Keep concise, calm microcopy style:
  - “Taken”, “Skip”, “Snooze”, “Due now”, “2 to come”.
- Implement consistent visual hierarchy:
  - large date header,
  - progress summary,
  - time-grouped dose cards,
  - one primary action per task context.
- Implement accessibility semantics:
  - non-color status labels,
  - readable touch targets,
  - focus order and screen reader labels.

### Verification & Definition of Done

- Every specified route is accessible by navigation flow.
- English content completeness audit = 100% for all reachable screens.
- No unresolved i18n keys in EN bundle.
- All main actions are reachable in <=2 taps from relevant context.
- Accessibility checklist pass for typography/touch targets/status semantics.

---

## Phase 7 — End-to-End Today Flow (Primary Product Surface)

### Detailed To-Dos

- Build Today dashboard:
  - date
  - adherence progress (today taken / total)
  - due/taken/skipped/missed dose list
- Keep taken doses visible (do not remove after completion).
- Implement one-tap dose confirmation.
- Implement skip and snooze actions.
- Add 10-minute undo affordance after taken action.
- Persist action events as MedicationAdministration records.
- Real-time UI recalculation:
  - progress numerator/denominator update
  - due/missed transitions.

### Verification & Definition of Done

- User can complete full daily loop from reminder -> open app -> mark dose.
- “Did I already take it?” answered from Today in <2 seconds.
- Undo behavior works only inside allowed time window.
- Reopening app reconstructs correct state from persisted records (not in-memory only).
- No stale status after app kill/restart.

---

## Phase 8 — End-to-End Medication Management

### Detailed To-Dos

- Add medication form with six fields:
  - name, form, strength, frequency, dose times, optional supply.
- Edit medication route and persistence logic.
- Pause medication with effective period tracking.
- Archive medication with safety prompt.
- Validate data entry:
  - required fields,
  - no impossible times,
  - duplicate-time handling.
- On change events:
  - regenerate schedule,
  - cancel stale reminders,
  - schedule new reminders.

### Verification & Definition of Done

- Create/edit/pause/archive actions complete without broken references.
- Mid-day add creates future doses only.
- Paused meds excluded from Today due list and adherence denominator.
- Archived meds hidden from active regimen and have no pending reminders.
- Form errors are clear and actionable.

---

## Phase 9 — History and Adherence Computation

### Detailed To-Dos

- Build 14-day history surface:
  - per-day adherence bar,
  - headline adherence percentage,
  - missed dose list details.
- Implement adherence formula exactly:

`adherence % = taken / (taken + skipped + missed) * 100`

- Exclude paused periods from denominator.
- Implement day drill-down detail screen if needed for correction flow.
- Lock historical recalculation policy to prevent silent metric drift.

### Verification & Definition of Done

- Hand-computed fixture matches app percentage exactly.
- Missing/skipped/taken counts reconcile with event records.
- History view remains performant with 20+ medications.
- No denominator inflation from paused intervals.

---

## Phase 10 — One-Page Doctor Report (PDF)

### Detailed To-Dos

- Implement report data assembler for selected date window.
- Compose one-page layout including:
  - patient name,
  - date range,
  - headline adherence,
  - per-medication adherence,
  - missed doses with dates/times.
- Guarantee one-page render policy:
  - typography, table truncation rules, overflow handling.
- Implement export/share flow appropriate to distribution channel.
- Add watermark/footer legal line (“self-reported adherence log”).

### Verification & Definition of Done

- PDF is exactly one page for 1, 6, and 20 medication scenarios.
- Values match in-app history computation.
- GP-readability check passes (core facts scannable in ~10 seconds).
- Export succeeds on both iOS and Android.

---

## Phase 11 — Consent, Privacy, Imprint, and Compliance UX

### Detailed To-Dos

- Build first-run explicit consent flow:
  - clear purpose text,
  - separate acceptance action,
  - timestamp + policy version capture in `Consent` resource.
- Implement consent revocation path in settings.
- Ensure legal pages are reachable without authenticated context if required.
- Add in-app non-device disclaimer copy matching listing language.
- Enforce data minimization:
  - no ad identifiers,
  - no third-party tracking on health surfaces,
  - only required fields persisted.
- Draft DPIA task package (if public-store track follows).

### Verification & Definition of Done

- App cannot proceed to medication logging without explicit consent.
- Consent grant + revocation audited with timestamps.
- Privacy notice and imprint reachable in <=2 taps from Settings.
- Legal copy available in EN and DE.
- Compliance review sign-off complete.

---

## Phase 12 — Localization, Accessibility, and UX Hardening

### Detailed To-Dos

- English-first launch copy finalization across all screens.
- German translations completed and reviewed.
- Ensure no untranslated keys in either locale.
- Accessibility pass:
  - text scaling up to 200%
  - minimum touch targets
  - semantic labels for assistive technologies
  - color not sole status signal
- Calm UX pass:
  - remove visual noise,
  - keep primary CTA clear,
  - avoid guilt-inducing or alarmist language.

### Verification & Definition of Done

- i18n key coverage = 100% EN + DE.
- Dynamic type stress test passes without clipping.
- Contrast and interaction targets meet baseline.
- UX review confirms “calm and clear” behavior for primary persona.

---

## Phase 13 — QA, Reliability, and End-to-End Test Gates

### Detailed To-Dos

- Build automated test suites:
  - unit: state machine, adherence math, schedule generation
  - integration: FHIR repository + notification scheduler
  - UI tests: critical user journeys
- Mandatory manual test matrix:
  - overnight reminder test
  - timezone travel simulation
  - DST transition simulation
  - app closed/app killed behaviors
  - offline mode reminder behavior
- Regression checklist for all tabs/routes and legal surfaces.
- Crash/error monitoring setup appropriate for internal release.

### Verification & Definition of Done

- All critical automated tests pass in CI.
- Manual test matrix pass signed by QA lead.
- No blocker/critical bugs open.
- Reminder reliability >= target threshold for release criteria.

---

## Phase 14 — Store Packaging, Listing, and Release Operations

### Detailed To-Dos

- Finalize app metadata:
  - name/subtitle/description EN+DE
  - screenshots in required order
  - legal disclaimer in listing.
- Build signed release artifacts for target distribution.
- Validate app icon/splash/branding assets.
- Run pre-release smoke tests on real devices.
- Publish to Actimi Appstore pipeline.
- Prepare public-store delta checklist (if Apple/Google planned later).

### Verification & Definition of Done

- Release binary signed and installable.
- Listing content includes mandatory non-medical-device disclaimer.
- Screenshot set reflects actual v1.0 behavior.
- Production release checklist signed by Product + QA + Engineering.
- App live on Actimi Appstore.

---

## 5) End-to-End Functional Traceability Matrix

| User Job | Required functionality | Technical implementation | Validation |
|---|---|---|---|
| “Tell me what to take now” | Today due list + reminders | schedule engine + local notifications + Today UI | reminder test + Today rendering tests |
| “Did I already take it?” | taken items remain visible | MedicationAdministration-driven status list | app restart state reconstruction test |
| “My routine changed today” | edit/pause schedules | MedicationRequest update + notification resync | mid-day add/pause tests |
| “Show my doctor facts quickly” | one-page report | adherence calculator + PDF render | 1/6/20 meds one-page verification |
| “Handle my data safely” | explicit consent + legal pages | Consent resource + in-app legal routes | consent gate + revocation audit |

---

## 6) Master Definition of Done (v1.0 Release Gate)

Takt v1.0 is “done” only when all conditions below are true:

1. All v1.0 MUST features shipped and demonstrable on real devices.
2. Spike risk gate passed and documented.
3. Reminder reliability validated overnight with app closed.
4. Every required route/tab exists and functions end-to-end.
5. English-first copy complete; German fully localized.
6. Consent flow enforced before health data use.
7. Privacy notice, imprint, and non-device disclaimer live in app.
8. Adherence calculation verified against hand-computed fixture.
9. Doctor report exports as one page for 1, 6, and 20 meds.
10. No out-of-scope decision-support features present.
11. QA sign-off complete; no unresolved critical defects.
12. Release artifacts published to Actimi Appstore.

---

## 7) Suggested Execution Timeline (Aligned to Brief)

- **Day 0 (Spike Day):** Phase 1 only (hard gate).
- **Day 1:** Phases 2–4 foundations (env, FHIR, schedule state machine).
- **Day 2:** Phases 5–8 core user loop (notifications, Today, Medications).
- **Day 3:** Phases 9–11 history/report/legal.
- **Day 4:** Phase 12 UX/i18n/accessibility polish + Phase 13 QA.
- **Day 5:** Phase 14 packaging and publish.

---

## 8) Immediate Next Actions (Actionable Start Checklist)

1. Run and document Phase 1 spike (go/no-go decision).
2. Freeze v1.0 backlog to MUST-only.
3. Stand up FHIR repository layer with typed contracts.
4. Implement schedule engine + state machine tests before UI completion.
5. Build Today screen + reminder flow as first end-to-end vertical slice.
6. Add compliance surfaces (consent/privacy/imprint) before release hardening.

---

**This plan is production-ready and can be used as the implementation source-of-truth for Takt v1.0 delivery.**
