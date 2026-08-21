# Takt — Reminder Reliability Certification Matrix (iOS + Android)

Purpose: verify medication reminders remain dependable in real device conditions before production rollout.

## Test setup (common)
- Use one test patient account with at least 2 active medications.
- Configure doses across morning, midday, and evening.
- Set snooze preference to 10 minutes.
- Ensure device time is automatic (network time) unless a case explicitly changes timezone.
- Record: device model, OS version, battery mode, app version, test date/time, tester name.

## Pass criteria (global)
- Reminder appears within acceptable tolerance window (<= 2 min deviation for scheduled reminder).
- Reminder payload shows correct medication label/time context.
- Opening from reminder lands in correct workflow (Today screen and relevant dose context).
- No duplicate bursts or silent misses for scheduled events.

---

## Matrix A — App closed + device locked (overnight)

### A1. iOS overnight
1. Force-close app on iOS.
2. Lock device; keep Wi-Fi/cellular as normal.
3. Leave overnight with at least one scheduled dose in test window.
4. In morning, verify reminder fired on time and dose action can be logged.

Expected: reminder delivered, user can mark taken/skipped/snooze, event persists in history.

### A2. Android overnight
1. Force-close app on Android.
2. Lock device overnight.
3. Repeat same schedule profile.
4. Verify notification delivery timing and action flow.

Expected: reminder delivered on schedule, no loss due to app closed state.

---

## Matrix B — Reboot persistence

### B1. iOS reboot
1. Schedule future dose (within 1–4 hours).
2. Reboot device before dose time.
3. Keep app closed after restart.
4. Verify reminder still fires.

Expected: schedule survives reboot.

### B2. Android reboot
1. Same as iOS reboot scenario.
2. Also verify with battery optimization ON and OFF.

Expected: schedule survives reboot in both modes.

---

## Matrix C — Timezone and DST drift

### C1. Timezone change
1. Schedule dose based on local wall-clock time.
2. Change timezone (e.g., UTC+1 → UTC+2 equivalent shift).
3. Verify next reminder fires at intended **local clock time**.

Expected: no drift relative to local time.

### C2. DST transition simulation/check
1. Execute test around DST transition window (or controlled simulation environment).
2. Verify reminder remains aligned with wall-clock schedule.

Expected: no skipped day, no duplicated reminder due to DST transition.

---

## Matrix D — Edit/pause/archive reconciliation

### D1. Edit dose time
1. Update medication time from T1 to T2.
2. Verify old reminder at T1 is canceled.
3. Verify new reminder at T2 is scheduled.

### D2. Pause medication
1. Set medication status to paused/on-hold.
2. Verify future reminders stop.

### D3. Archive medication
1. Archive/stopped medication.
2. Verify no further reminders fire.

Expected: schedule always reflects latest regimen state.

---

## Matrix E — Snooze reliability

### E1. Snooze trigger
1. Fire a reminder.
2. Tap snooze (10m).
3. Verify follow-up reminder arrives ~10 minutes later.

Expected: one follow-up reminder, no duplicate chains.

---

## Failure classification
- **Critical:** reminder not delivered in required window.
- **Major:** reminder delivered but wrong medication/time or broken handoff.
- **Minor:** cosmetic issue with content but clinical meaning intact.

Any Critical failure blocks production release.
