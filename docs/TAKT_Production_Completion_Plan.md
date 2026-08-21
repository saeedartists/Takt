# Takt v1.0 Production Completion Plan

## Objective
Deliver a complete, publish-ready medication reminder and adherence app that can be released on the Actimi Appstore now and prepared for public store submission later.

---

## 1) Scope Lock

### Will ship in v1.0
- Consent and reminder-permission onboarding
- Medication add/edit/pause/archive
- Daily medication reminders
- Today actions: taken / skipped / snooze / missed
- 14-day adherence history
- One-page doctor report (PDF)
- Settings, privacy, imprint, and full EN/DE localization

### Will not ship in v1.0 (by decision)
- Drug interaction warnings
- Dose recommendations or advice
- Risk scores
- Sensor-derived vitals
- Ads or data monetization

---

## 2) Backend Data Model (Ovok FHIR)

- **Patient**: app user profile
- **Medication**: medication details
- **MedicationRequest**: regimen cadence and schedule
- **MedicationAdministration**: dose events (taken/skipped/missed)
- **Consent**: explicit Article 9 GDPR consent record

---

## 3) App Architecture

- Mobile app using Expo + React Native
- Ovok FHIR API as source of truth
- Local device notifications for reliable reminders (offline / app-closed)
- Local cache only for UX/performance, not primary medical record

---

## 4) Functional Flow (How each core function works)

### A. Onboarding + Consent
1. First app launch shows explicit health-data consent and non-medical-device notice.
2. User accepts.
3. App creates a FHIR **Consent** record.
4. Notification permission is requested.
5. User proceeds to Today screen.

### B. Medication Setup
1. User enters 6 fields: name, form, strength, cadence, time(s), optional supply.
2. App creates:
   - FHIR **Medication**
   - linked **MedicationRequest** with timing instructions
3. Local reminders are scheduled from regimen.

### C. Reminder + Daily Adherence Loop
1. Notification fires at scheduled time.
2. Today screen shows dose state.
3. User action writes event:
   - Taken -> `MedicationAdministration.status = completed`
   - Skipped -> `status = not-done` + reason
   - Snooze -> delayed local reminder
4. If no action after grace window, app writes missed event.

### D. History + Corrections
1. App computes 14-day adherence:
   - `taken / (taken + skipped + missed)`
2. Displays daily bars and missed list.
3. Corrections are done from History via controlled edit path.

### E. Doctor Report (PDF)
One-page export containing:
- Patient name
- Date range
- Overall adherence %
- Per-medication adherence
- Missed doses with dates

### F. Settings + Legal
- EN/DE language switching
- Reminder/snooze preferences
- In-app privacy notice and imprint
- Consent withdrawal path

---

## 5) Production Hardening Phases

### Phase 1 — Switch from mock to real backend
- Disable mock mode
- Set tenant/auth configuration
- Validate patient login and token flow

### Phase 2 — Data safety and access control
- Enforce patient-only visibility
- Verify no cross-user data exposure
- Validate FHIR references and ownership

### Phase 3 — Reliability hardening
- Reminder rehydration after reboot/update
- Timezone and DST behavior verification
- Android exact alarm behavior checks

### Phase 4 — Compliance readiness
- Final DE/EN legal copy
- Consent auditability checks
- Data minimization review
- DPIA draft package for public stores

### Phase 5 — QA and release gates
- Typecheck/build/prebuild clean
- Localization completeness
- Accessibility checks (text scaling, 44pt targets, non-color-only states)
- Real-device overnight reminder verification

### Phase 6 — Appstore packaging prep
- Store metadata and screenshots
- Internal Actimi release build
- Public-store submission package prepared for later push

---

## 6) Definition of “Complete App”
Takt v1.0 is complete when:
- All v1.0 MUST features run on live backend
- Reminder reliability is verified on real devices
- EN/DE translations are complete across reachable screens
- Consent and legal flows are in place and usable
- Doctor report exports correctly in edge-case fixture sets
- Release build is ready for Actimi Appstore, with public-store package prep complete

---

## Next Execution Step
Start with **Phase 1: switch app from mock mode to live Ovok backend and validate auth/data flow end-to-end**.
