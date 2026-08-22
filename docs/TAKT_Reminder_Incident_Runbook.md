# Takt — Incident Runbook: “Reminders did not fire”

Purpose: give support and operations a fast, repeatable path to triage and resolve reminder-delivery failures.

## Severity model
- **SEV-1:** widespread reminder failure across many users/devices.
- **SEV-2:** failures isolated to one platform cohort (for example Android battery-optimized devices).
- **SEV-3:** single-user or single-device failure.

## Intake checklist (first 5 minutes)
Capture before troubleshooting:
- User account identifier
- Device model + OS version
- App version/build
- Medication schedule affected (time + label)
- Whether app was foreground/background/closed
- Battery mode / low power mode status
- Last known successful reminder timestamp

## Triage decision tree

### 1) Is this isolated or widespread?
- If multiple users report same window/platform: escalate as SEV-1/SEV-2.
- If single user: continue per-device triage.

### 2) Did schedule exist for that time?
- Confirm medication was active (not paused/archived).
- Confirm dose time still matched current regimen.
- Confirm no recent edit invalidated the old schedule.

### 3) Device notification prerequisites
- Notifications permission granted.
- OS-level app notifications enabled.
- Do-not-disturb/focus mode not suppressing alerts.
- Android: battery optimization / background restriction checks.

### 4) App lifecycle + sync state
- Verify reminder sync ran after last medication edit.
- Verify app did not hold stale schedule signature.
- If stale: force schedule resync and retest.

### 5) Reproduce with controlled test
- Create one reminder in near-term window (5–10 minutes).
- Close app and lock device.
- Observe delivery and capture evidence.

## Standard remediation actions
1. Re-run reminder schedule synchronization.
2. Ask user to re-enable notification permissions and OS notification channel.
3. On Android, exclude app from battery optimization for critical reminders.
4. Validate medication state (active vs paused/archived) and corrected dose time.
5. If unresolved, escalate to engineering with evidence packet.

## Evidence packet for escalation
- Incident ID and severity
- Reproduction steps
- Device/app/environment details
- Expected vs actual behavior
- Timestamped screenshots/videos
- Any relevant logs and prior successful reminder timestamp

## Engineering handoff expectations
Engineering should classify into one of:
- scheduling bug
- lifecycle/reboot rehydration bug
- timezone/DST drift bug
- OS-policy suppression behavior
- user configuration issue

For confirmed product defects, add:
- root cause summary
- fix PR/commit reference
- regression test case ID
- rollout/rollback note

## Closeout checklist
- User-facing resolution communicated.
- Knowledge base entry updated (if new pattern).
- Test matrix updated to prevent recurrence.
- Incident reviewed in release-readiness board.
