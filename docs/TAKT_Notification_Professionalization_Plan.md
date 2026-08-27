# Takt — Notification Scheduling Professionalization Plan

## Current v1.0 status
- Local scheduling exists via native notification APIs (`expo-notifications`).
- Reminder sync runs on plan change in app session.

## Hardening actions toward release-quality
1. Permission prompt timing
   - Request permission only at value-obvious moment (consent/onboarding step)
   - Persist decision and expose re-prompt guidance

2. Resync lifecycle coverage
   - App launch
   - App resume
   - Schedule mutation
   - Pause/archive reconciliation
   - Timezone change reconciliation

3. Deep-link action routing
   - Notification tap opens Today
   - Focus specific dose row by scheduled timestamp + request id

4. Observability log model
   - schedule.created
   - schedule.cancelled
   - schedule.reconciled
   - delivery.opened
   - delivery.failed (with reason)

5. Platform certification
   - iOS overnight closed-app reliability
   - Android overnight closed-app reliability
   - Reboot persistence and exact-alarm behavior audit

## Note on stack
Prompt text referenced Capacitor plugin. This codebase is Expo/React Native, so native local scheduling is implemented with `expo-notifications` and platform channels/permissions.
