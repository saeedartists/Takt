# Takt — Adherence Edge-Case Fixture Report

Date: 2026-08-27
Scope: state machine + denominator correctness + edge-case reconstruction behavior

## Engine changes shipped
- `src/lib/takt/schedule.ts`
  - Added explicit helpers:
    - `graceWindowCloseAt(scheduledAt)`
    - `resolveDoseState(scheduledAt, now, event?)`
    - `localScheduledKey(date)`
  - Event matching now keys by local wall-clock day+time per request reference.
  - `buildHistory` now accepts deterministic options `{ today, now }` to support repeatable fixture tests.

## Fixture suite
- Source: `src/lib/takt/fixtures/adherence-fixtures.ts`
- Runner: `scripts/verify-adherence-fixtures.ts`
- Run command:

```bash
pnpm dlx tsx scripts/verify-adherence-fixtures.ts
```

## Verified scenarios (all PASS)
1. **1 medication fixture** — mixed taken/skipped/missed with expected 50%
2. **6 medications fixture** — expected 67%
3. **20 medications fixture** — expected 60%
4. **Mid-day add** — creates only future doses on add day
5. **Paused interval exclusion** — paused window contributes zero denominator
6. **State machine boundaries** — scheduled → due → missed transitions at grace boundary
7. **Parallel same-time doses** — two meds at same time remain separate records and outcomes

## Raw result snapshot
- PASS fixture-1-med
- PASS fixture-6-med
- PASS fixture-20-med
- PASS edge-midday-add
- PASS edge-pause-exclusion
- PASS edge-state-machine
- PASS edge-parallel-doses

## Release implication
The adherence engine now has deterministic fixture evidence for the key v1.0 release edge cases and denominator integrity requirements.
