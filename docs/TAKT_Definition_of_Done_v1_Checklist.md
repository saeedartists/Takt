# Takt — Definition of Done v1.0 (Real Device Checklist)

## Gate 1 — v1.0 MUST features on real devices
- [ ] Medication CRUD on iOS + Android real device
- [ ] Today timeline with dose confirmation works on both
- [ ] History/adherence loads and matches events
- [ ] Reminder fires with app in background and with app closed

## Gate 2 — spike risk gate signed
- [ ] Builder output shape documented
- [ ] Overnight reminder risk findings documented
- [ ] Tech lead + Product go/no-go recorded

## Gate 3 — overnight reminder reliability
- [ ] iOS overnight with app closed + lock-screen
- [ ] Android overnight with app closed + lock-screen
- [ ] Reboot persistence on both platforms
- [ ] Timezone + DST transition checks

## Gate 4 — required routes end-to-end
- [ ] Today
- [ ] Medications list/add/edit/pause/archive
- [ ] History
- [ ] Report
- [ ] Settings/legal/readiness routes

## Gate 5 — copy and localization
- [ ] EN strings complete on all reachable screens
- [ ] DE strings complete on all reachable screens
- [ ] No missing key rendered at runtime
- [ ] Native-language review pass recorded

## Gate 6 — consent enforcement
- [ ] First-run consent shown before health-data features
- [ ] No bypass path without consent acceptance
- [ ] Consent create event stored with timestamp
- [ ] Consent withdrawal flow works and is auditable

## Gate 7 — legal surfaces
- [ ] Privacy notice reachable within two taps from Settings
- [ ] Imprint reachable within two taps from Settings
- [ ] Non-medical-device disclaimer visible in app
- [ ] EN + DE legal copy available

## Gate 8 — adherence math correctness
- [ ] Hand-computed fixtures pass (1/6/20 meds)
- [ ] Edge cases from §12 pass
- [ ] Paused periods excluded from denominator

## Gate 9 — one-page doctor report
- [ ] 1-med report exports as one page
- [ ] 6-med report exports as one page
- [ ] 20-med report exports as one page
- [ ] Report values match history calculations

## Gate 10 — out-of-scope features absent
- [ ] No drug interaction warnings
- [ ] No dose recommendations
- [ ] No risk scores
- [ ] No sensor-derived clinical advice
- [ ] No symptom checker
- [ ] No ads or data monetisation flows

## Gate 11 — QA sign-off
- [ ] Critical defects closed
- [ ] QA sign-off document complete
- [ ] No unresolved blockers

## Gate 12 — release ops readiness
- [ ] Signed binary build artifacts
- [ ] Actimi Appstore listing package
- [ ] Privacy policy + terms linked
- [ ] Launch checklist complete
