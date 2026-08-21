# Takt Industrialization TODO (Post-v1 Feature Complete)

## Status legend
- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked (external)

## Wave 1 — Release-critical

### 1) Backend auth + access control
- [!] Enable tenant patient auth settings (`PATIENT_LOGIN_ENABLED`, `PATIENT_REGISTRATION_ENABLED`)  Blocker: settings write path currently returns `key-not-found` in Builder tools.
- [x] Improve app-side backend readiness diagnostics and routing when live backend is unreachable/misconfigured.
- [ ] Execute patient isolation verification matrix (User A cannot read User B data).
- [ ] Capture evidence: request/response logs and signed QA report.

### 2) Reminder reliability certification
- [ ] Real-device overnight reminder test (iOS + Android, app closed/locked)
- [ ] Reboot reminder rehydration test
- [ ] Timezone + DST transition test
- [ ] Low-power / battery optimization behavior test
- [ ] Certification report with pass/fail and mitigation notes

### 3) Compliance/legal closeout
- [ ] Replace draft imprint values with final legal entity data
- [ ] Legal review for privacy/consent copy (EN/DE)
- [ ] Consent evidence package (versioned copy + timestamp traceability)
- [ ] DPIA package draft

## Wave 2 — Security + operability

### 4) Security hardening
- [ ] Session/token lifecycle test matrix (sign-in, refresh, sign-out, expiry)
- [ ] API abuse checks (rate limits / malformed payloads)
- [ ] Production secret/config governance checklist

### 5) Observability + support
- [ ] Define event taxonomy (reminder schedule, delivery, dose write, report export)
- [ ] Incident runbook: “Reminders did not fire”
- [ ] Alert thresholds and on-call response path

## Wave 3 — UX/QA industrial polish

### 6) Accessibility and UX resilience
- [ ] Dynamic text stress test
- [ ] Screen reader journey pass
- [ ] Error recovery loops for auth, fetch, and report export

### 7) QA and release train
- [ ] Device/os matrix regression run
- [ ] Staging → internal rollout checklist
- [ ] Rollback/hotfix SOP

---

## Current execution focus
**Now working on Wave 1, item 1:** backend-readiness diagnostics and auth-failure guidance in-app while tenant setting write path is externally blocked.
