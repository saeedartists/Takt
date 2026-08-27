# Takt — Report Parity Evidence (History ↔ PDF Summary)

Date: 2026-08-27

## Objective
Lock report math so exported doctor-report values always match the same adherence computation used in app history.

## Implementation
- Added `src/lib/takt/report-summary.ts`
  - `buildReportSummary({ plans, history, formatMissedDateTime })`
  - Single source for:
    - headline adherence percentage
    - per-medication adherence rows
    - missed-dose rows
- Updated `app/report.tsx` to consume `buildReportSummary` instead of local duplicate math.

## Deterministic verification
- Added fixture suite: `src/lib/takt/fixtures/report-parity-fixtures.ts`
- Added runner: `scripts/verify-report-parity.ts`

Run:

```bash
pnpm dlx tsx scripts/verify-report-parity.ts
```

## Scenarios (PASS)
1. 1-medication scenario: report=50%, history=50%
2. 6-medication scenario: report=67%, history=67%
3. 20-medication scenario: report=60%, history=60%

All scenarios confirm missed-dose row counts also reconcile with history totals.
