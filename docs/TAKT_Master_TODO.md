# Takt Master TODO — multi-perspective production backlog

## How to use this board
- Keep this list as the single source of truth.
- Use status tags: `[ ]` not started, `[~]` in progress, `[x]` done, `[!]` blocked external.
- Execution order recommendation: **A → B → C → D → E → F → G**.

---

## A) Product & clinical workflow (highest impact)
- [~] Dose loop UX hardening (today actions + undo + missed auto-mark review)
- [x] Medication create/edit/pause/archive workflow
- [x] 14-day adherence history + correction path
- [x] One-page doctor report + PDF export
- [ ] Real clinician review of report wording and utility

## B) UX/design quality
- [x] Calm, low-cognitive-load tab IA (Today / Medications / History / Settings)
- [x] EN/DE copy baseline across all reachable routes
- [ ] Final copy polish pass with clinical operations team
- [ ] Dark/light contrast audit on real devices

## C) Data/FHIR integrity
- [x] Patient + Medication + MedicationRequest + MedicationAdministration + Consent graph
- [x] Mutation layer with validation and operation error handling
- [ ] Live-tenant patient A/B isolation evidence run
- [ ] Export evidence package (screens + request logs)

## D) Reminders reliability (device reality)
- [x] Scheduler and snooze implementation
- [ ] iOS app-closed overnight reminder test matrix
- [ ] Android app-closed overnight reminder test matrix
- [ ] Reboot/timezone/DST reliability matrix

## E) Security & privacy/compliance
- [x] Explicit consent + withdraw path
- [x] Privacy + imprint screens in-app
- [ ] Final legal text approval (EN/DE)
- [ ] Consent audit package (versioned text + timestamp evidence)

## F) Operations/readiness
- [~] In-app release readiness board (operators can track completion)
- [ ] Incident runbook: “reminders did not fire”
- [ ] Staged rollout + rollback SOP

## G) QA & release gates
- [ ] Cross-device regression matrix execution
- [ ] Accessibility stress test (dynamic type + SR journey)
- [ ] Final production dry run and sign-off

---

## What started now
1. ✅ Added an **interactive release-readiness checklist** inside `Settings → Release readiness`.
2. ⏭ Next recommended item: run and document the **patient A/B data isolation matrix** against live backend.
