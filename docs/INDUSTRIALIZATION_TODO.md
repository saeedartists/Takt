# Takt Industrialization TODO (v1.0 → production-grade)

## Status key
- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked externally

## Phase 1 — Backend auth + tenant readiness (Priority 1)
- [~] In-app release readiness dashboard with live auth probe (implemented)
- [!] Enable `PATIENT_LOGIN_ENABLED` on tenant (external admin action)
- [!] Enable `PATIENT_REGISTRATION_ENABLED` on tenant (external admin action)
- [ ] Execute patient sign-in + registration E2E on live backend and capture evidence
- [ ] Produce A/B patient data-isolation evidence set (Patient, MedicationRequest, MedicationAdministration, Consent)

## Phase 2 — Access isolation proof (Priority 1)
- [~] Isolation evidence checklist drafted (this sprint)
- [ ] Execute patient A / patient B separation test matrix on live backend
- [ ] Save pass/fail evidence and remediation notes

## Phase 3 — Reminder reliability certification (Priority 1)
- [ ] Device-closed reminders (iOS/Android)
- [ ] Reboot persistence checks
- [ ] Timezone and DST shift checks
- [ ] Low battery / background restriction checks
- [ ] Reminder reconciliation after medication edits/pause/archive

## Phase 4 — Compliance/legal hardening (Priority 1)
- [ ] Final legal entity details (imprint)
- [ ] Legal-approved privacy copy EN/DE
- [ ] Consent evidence package (versioned text + timestamps + withdrawal proof)
- [ ] DPIA package draft

## Phase 5 — Security hardening (Priority 1)
- [ ] Token/session invalidation checks
- [ ] Brute-force/rate-limit checks
- [ ] Malformed payload and OperationOutcome UX checks
- [ ] Production secrets/config governance checklist

## Phase 6 — Observability + operations (Priority 2)
- [ ] Define event taxonomy (reminders, adherence actions, report export, failures)
- [ ] Alert thresholds and incident runbook
- [ ] Support runbook: “reminders did not fire”

## Phase 7 — QA + release management (Priority 2)
- [ ] Cross-device matrix execution
- [ ] Accessibility stress tests (large text, screen reader flow, contrast)
- [ ] Staged rollout protocol and rollback SOP

## Current execution order
1. Phase 1: backend auth unblock and live tenant readiness
2. Phase 2: patient data isolation proof
3. Phase 3: reminder reliability certification
4. Phase 4–7: compliance, security, observability, QA, and release operations
