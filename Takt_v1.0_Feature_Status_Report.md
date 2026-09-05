# Takt v1.0 — Feature Status Report

**Date:** August 2026
**Current Commit:** 44be3f9
**Runtime Mode:** Mock (EXPO_PUBLIC_OVOK_MOCK=1)
**Backend Status:** Blocked (tenant patient auth settings return key-not-found)

---

## Executive Summary

Takt v1.0 is a medication adherence tracker built with React Native (Expo) targeting the Ovok/Actimi FHIR R4 backend. The full UI layer is built with all screens and navigation wired. The app currently runs in **mock mode** with sample data because the live backend tenant patient auth settings are blocked (write path returns key-not-found). This means the app is **demo-functional** on mock data but **not yet connected to a live patient backend**.

---

## Feature Inventory

### A. FULLY IMPLEMENTED — Core User Flows

**1. Article 9 Consent Flow**
- Screen: `app/consent.tsx`
- Displays legal consent text (EN/DE), safety note, permissions hint.
- Records consent to FHIR backend via `useRecordConsent` mutation.
- Creates or links patient profile via `useEnsurePatient`.
- Requests notification permissions via `expo-notifications`.
- Stores acceptance flag in AsyncStorage to skip on relaunch.
- Status: Complete.

**2. Today Tab — Daily Dose Timeline**
- Screen: `app/(tabs)/today.tsx`
- Groups doses into Upcoming, Overdue, and Earlier sections.
- Each dose row shows: medication name, scheduled time, status badge (Due/Taken/Skipped/Missed).
- Actions per dose:
  - **Confirm** — marks dose as taken via `useRecordDose` mutation. Triggers undo toast with 10-second countdown.
  - **Skip** — marks dose as skipped.
  - **Snooze** — opens modal with 5/10/15/30 minute options. Schedules local notification via `scheduleSnoozeReminder`.
  - **Undo** — reverses a taken/skipped event within 10 minutes of recording via `useUndoDose` mutation.
- Shows adherence summary card with taken/missed/skipped counts.
- Empty state: "All done for today" when all doses are handled.
- Status: Complete.

**3. Medications Tab — Regimen List**
- Screen: `app/(tabs)/medications.tsx`
- Groups medication plans by status: Active, Paused, Archived.
- Shows count badges for each group.
- Each row shows: medication name, cadence, times, form.
- Tapping a row navigates to edit screen.
- "Add Medication" button navigates to create form.
- "Open Report" button navigates to report screen.
- Status: Complete.

**4. Add Medication — New Plan Form**
- Screen: `app/medications/new.tsx`
- Fields: Name, Form (Tablet/Capsule/etc), Strength, Cadence (Daily/Weekdays/Specific Days), Times (comma-separated HH:MM), Supply count (optional).
- Cadence toggle shows WeekdayPicker when "Specific Days" is selected.
- Validates: name required, valid time format (HH:MM), at least one day for custom cadence.
- Creates FHIR MedicationRequest + Medication via `useCreateMedicationPlan` mutation.
- Status: Complete.

**5. Edit Medication — Modify Plan**
- Screen: `app/medications/[id].tsx`
- Pre-fills all fields from existing plan.
- Same fields as add form plus Status toggle (Active / Paused / Archived).
- Status changes: Active -> on-hold (Paused) -> stopped (Archived).
- Updates via `useUpdateMedicationPlan` mutation.
- Status: Complete.

**6. History Tab — 14-Day Adherence**
- Screen: `app/(tabs)/history.tsx`
- Builds 14-day history from medication plans + dose events via `buildHistory`.
- Shows adherence trend sparkline chart (category-colored).
- Displays adherence percentage and taken/skipped/missed badge counts.
- Missed Doses section: lists all missed doses from the 14-day window.
- "Mark as taken" button on missed doses: undoes existing event if present, then records new taken event. Allows correcting historical records.
- Status: Complete.

**7. Report — PDF Clinical Export**
- Screen: `app/report.tsx`
- Builds report summary from plans + history via `buildReportSummary`.
- Displays: patient name, date, adherence percentage, per-medication breakdown.
- "Export PDF" button:
  - Generates A4 HTML via string template with styled tables.
  - Renders to PDF via `expo-print` (`printToFileAsync`).
  - Shares via `expo-sharing` (native share sheet).
  - Limits: 20 medications, 12 missed rows in PDF.
  - Includes disclaimer footer.
- Status: Complete.

**8. Settings — Language Switch (EN/DE)**
- Screen: `app/(tabs)/settings.tsx`
- SegmentedControl toggles between English and Deutsch.
- Full i18n coverage: all labels, titles, error messages, day names, status labels.
- Persisted to AsyncStorage.
- Status: Complete.

**9. Settings — Snooze Duration Preference**
- Screen: `app/(tabs)/settings.tsx`
- SegmentedControl: 5m / 10m / 15m / 30m.
- Persisted via `useReminderPreferences` hook.
- Default: 15 minutes.
- Status: Complete.

**10. Settings — Legal Screens**
- Privacy Notice: `app/settings/privacy.tsx` — static legal text.
- Imprint: `app/settings/imprint.tsx` — static legal text.
- Status: Complete (static content).

**11. Settings — Sign Out**
- Screen: `app/(tabs)/settings.tsx`
- Clears active login from `ovokClient`, navigates to sign-in.
- Hidden when mock mode is active.
- Status: Complete (non-mock path).

**12. Settings — Withdraw Consent**
- Screen: `app/(tabs)/settings.tsx`
- Calls `useWithdrawConsent` mutation against FHIR backend.
- Removes consent flag from AsyncStorage.
- Navigates back to consent screen.
- Status: Complete.

---

### B. IMPLEMENTED — QA / Certification Boards

**13. Accessibility Pass**
- Screen: `app/settings/accessibility-pass.tsx`
- 8 test cases covering: Large Text (Today/Meds/History), Screen Reader (Tab/Dose), Non-Color Status Cues, Focus Order, Rotation Stability.
- Interactive toggles: tap to mark case as done/pending.
- Evidence metadata fields: Tester Name, Run Date, Device Summary, Assistive Tech Used, Evidence Links, Notes.
- Progress bar with completion percentage.
- Gate badge: Pass when all 8 cases complete + evidence filled.
- Auto-syncs status to readiness checklist.
- Status: Complete as a QA board. Not a user-facing feature.

**14. Reminder Certification**
- Screen: `app/settings/reminder-certification.tsx`
- 10 test cases covering: iOS/Android Overnight, Reboot, Timezone Shift, DST, Edit/Pause/Archive Reconciliation, Snooze Reliability.
- Same interactive toggle + evidence metadata pattern as Accessibility Pass.
- Auto-syncs iOS Overnight, Android Overnight, and Timezone/DST status to readiness checklist.
- Status: Complete as a QA board. Not a user-facing feature.

**15. Release Readiness Checklist**
- Screen: `app/settings/readiness.tsx`
- Aggregated checklist of all release gate conditions.
- Receives auto-synced status from Accessibility Pass and Reminder Certification.
- Status: Complete as a QA board.

**16. Patient A/B Isolation Matrix**
- Screen: `app/settings/isolation.tsx`
- Visual matrix showing what data Patient A can see vs Patient B.
- Documents cross-patient data isolation boundaries.
- Status: Complete as a documentation/QA board.

**17. Report Review**
- Screen: `app/settings/report-review.tsx`
- Clinician review and sign-off interface for reports.
- Status: Implemented.

**18. Session Security QA**
- Screen: `app/settings/session-security.tsx`
- Token lifecycle QA matrix.
- Status: Implemented.

**19. Consent Audit**
- Screen: `app/settings/consent-audit.tsx`
- Audit trail for consent events.
- Status: Implemented.

---

### C. FOUNDATION ONLY — Not Yet Functional

**20. Family Sharing**
- Screen: `app/settings/family-sharing.tsx`
- v1.0 includes: data model (FHIR RelatedPerson), guardrails, scope display.
- Shows grant list (reads from backend).
- Displays scope rules: View timeline (allowed), Quiet reminders (allowed), Edit regimen (blocked), View diary (blocked), Withdraw consent (blocked).
- **What is NOT implemented yet:**
  - Per-relative Article 9 consent flow (planned for v1.1).
  - No UI to create or manage grants.
  - No invite/accept flow for relatives.
  - The "Open Relative View" button works but shows the current patient's own data in a read-only layout.
- Status: UI shell with model and guardrails. **Not a functional sharing feature.**

**21. Relative View**
- Screen: `app/settings/relative-view.tsx`
- Read-only dose timeline layout.
- Shows today's doses with status badges.
- Lists blocked capabilities (edit, diary, withdraw).
- **What is NOT implemented:**
  - No actual relative/caregiver authentication.
  - Shows the logged-in patient's own data, not a linked relative's data.
- Status: **Layout preview only. Not connected to a real caregiver flow.**

---

### D. NOT IMPLEMENTED — Known Gaps

**22. Live Authentication**
- Sign-in and registration screens exist: `app/auth/sign-in.web.tsx`, `register.web.tsx`, `reset-password.web.tsx`.
- Backend blocker: tenant patient auth settings (PATIENT_LOGIN_ENABLED, PATIENT_REGISTRATION_ENABLED) return `key-not-found` on the update path.
- The app cannot authenticate real patients until this is resolved.
- Status: **BLOCKED on backend.**

**23. Push Notification Delivery**
- Local notifications are scheduled (snooze reminders, dose reminders).
- Actual push notification infrastructure (APNs/FCM) not wired in mock mode.
- Status: Local scheduling works. **Push delivery not verified.**

**24. Supply Tracking / Refill Reminders**
- Supply count field exists in medication form.
- No UI or logic to track depletion or alert for refills.
- Status: **Data field only. No feature.**

---

## App Navigation Map

```
Consent Screen
  |
  v
Today Tab (dose timeline, confirm/skip/snooze/undo)
  |
  v
Medications Tab (regimen list, add/edit)
  |--- Add Medication (new plan form)
  |--- Edit Medication (modify plan)
  |
History Tab (14-day adherence, missed dose correction)
  |
Report (PDF clinical export)
  |
Settings Tab
  |--- Language (EN/DE)
  |--- Reminder Preferences (snooze duration)
  |--- Privacy Notice
  |--- Imprint
  |--- Family Sharing (v1.0 shell)
  |--- Relative View (layout preview)
  |--- Consent Audit
  |--- Accessibility Pass (QA board)
  |--- Reminder Certification (QA board)
  |--- Release Hub
  |--- Readiness Checklist
  |--- Isolation Matrix
  |--- Report Review
  |--- Session Security
  |--- Sign Out
  |--- Withdraw Consent
```

---

## Runtime Notes

- Expo Go on physical device is the only test target (no Xcode installed on dev machine).
- Dev server: `npm start` on port 8081.
- Mock mode flag: `.env.local` contains `EXPO_PUBLIC_OVOK_MOCK=1`.
- When mock mode is off, the app attempts real FHIR backend calls which will fail due to the auth blocker.
- Fresh Metro cache rebuild: `npx expo start --clear`.
