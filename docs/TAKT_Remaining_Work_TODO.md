# Takt — Remaining Work TODO (Recommended Execution Order)

Status: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked external

## 1) Release-readiness operations (inside app)
- [x] Add interactive release-readiness checklist with persistent progress in `Settings → Release readiness`.
- [~] Add release control center that consolidates all critical launch gates in one operator view. (Shipped at `Settings → Release control center`)
- [ ] Validate checklist UX with non-technical operators (clinician/ops lead) and adjust copy if needed.

## 2) Live backend verification (highest production risk)
- [!] Run live sign-in + registration smoke test on connected tenant. (Blocked: tenant patient auth settings currently return `key-not-found` on update path)
- [~] Execute patient A/B data-isolation matrix (no cross-patient read/write). (In-app matrix tracker + evidence metadata screen shipped)
- [~] Capture evidence package (screens + request/response traces + pass/fail notes). (Evidence metadata capture now in app)

## 3) Reminder reliability certification (real-device)
- [~] iOS overnight reminder test with app closed and phone locked. (In-app certification tracker shipped; awaiting real-device execution)
- [~] Android overnight reminder test with app closed and phone locked. (In-app certification tracker shipped; awaiting real-device execution)
- [~] Reboot persistence test. (In-app certification tracker shipped; awaiting real-device execution)
- [~] Timezone + DST drift test. (In-app certification tracker shipped; awaiting real-device execution)

## 4) Clinical/report quality
- [~] Clinician review of doctor report wording and layout. (In-app review/sign-off board shipped)
- [~] Incorporate wording updates from review and re-export validation samples. (Change log capture added to review board)

## 5) Legal/compliance closeout
- [ ] Replace draft imprint fields with final legal entity details.
- [ ] Final legal review of EN/DE privacy + consent copy.
- [~] Consent audit trail pack (grant + withdraw traceability evidence). (In-app consent audit board + FHIR trace view shipped)

## 6) Security + operations
- [~] Session/token lifecycle QA matrix. (In-app execution board shipped)
- [~] Malformed payload and error-surfacing checks. (Tracked in session/token QA board as MP-01 and MP-02)
- [~] Support runbook: “reminders did not fire”. (Runbook prepared)

## 7) Final QA + release gates
- [~] Accessibility stress pass (large text + screen reader flows). (Board shipped in Settings → Accessibility stress pass; operator run + evidence still to be completed per release cycle.)
- [ ] Cross-device regression matrix.
- [ ] Final production dry run sign-off.

---

## Work started now
✅ Completed item 1.1 in this iteration (interactive readiness checklist shipped).
➡️ Next recommended execution item: **3. execute reminder reliability certification on real devices and fill the evidence log (A1–E1)**.

- [~] Evidence package normalization across release boards (screenshots, logs, reviewer signature). (Implemented in-app evidence-links fields + gate enforcement; operator artifacts still need real run uploads each cycle.)
