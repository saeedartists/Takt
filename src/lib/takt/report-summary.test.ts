import { describe, expect, it } from 'vitest';

import { buildReportSummary } from './report-summary';
import type { HistoryDay } from './schedule';
import type { DoseOccurrence, MedicationPlan } from './types';

const day = (key: string, doses: Array<Pick<DoseOccurrence, 'requestId' | 'state' | 'label'>>): HistoryDay => ({
  date: new Date(2026, 0, 1),
  key,
  taken: doses.filter((d) => d.state === 'taken').length,
  skipped: doses.filter((d) => d.state === 'skipped').length,
  missed: doses.filter((d) => d.state === 'missed').length,
  adherencePct: 0,
  doses: doses.map((dose) => ({
    ...dose,
    id: `${key}-${dose.requestId}`,
    scheduledAt: new Date(2026, 0, 1, 8, 0),
  })),
});

const plan = (id: string, label: string): MedicationPlan =>
  ({
    request: { id },
    medication: null,
    label,
    form: 'Tablet',
    strength: '10 mg',
    times: ['08:00'],
    cadence: 'daily',
    dayOfWeek: ['mon'],
    pauseHistory: [],
  }) as unknown as MedicationPlan;

const formatMissedDateTime = (value: Date): string => value.toISOString();

describe('buildReportSummary', () => {
  it('aggregates taken/skipped/missed per medication and overall pct', () => {
    const plans = [plan('req-a', 'Plan A'), plan('req-b', 'Plan B')];
    const history: HistoryDay[] = [
      day('2026-01-01', [
        { requestId: 'req-a', state: 'taken', label: 'Plan A' },
        { requestId: 'req-a', state: 'missed', label: 'Plan A' },
        { requestId: 'req-b', state: 'taken', label: 'Plan B' },
        { requestId: 'nope', state: 'taken', label: 'Orphan' },
      ]),
      day('2026-01-02', [
        { requestId: 'req-a', state: 'skipped', label: 'Plan A' },
        { requestId: 'req-b', state: 'scheduled', label: 'Plan B' },
      ]),
    ];

    const summary = buildReportSummary({ plans, history, formatMissedDateTime });

    expect(summary.pct).toBe(50); // 2 taken / 4 counted
    expect(summary.taken).toBe(2);
    expect(summary.denominator).toBe(4);

    const byId = new Map(summary.byMedication.map((m) => [m.id, m]));
    expect(byId.get('req-a')).toMatchObject({ taken: 1, denominator: 3, pct: 33 });
    expect(byId.get('req-b')).toMatchObject({ taken: 1, denominator: 1, pct: 100 });
    // An event without a matching plan is ignored.
    expect(summary.byMedication).toHaveLength(2);
  });

  it('lists every missed dose with a formatted label', () => {
    const history: HistoryDay[] = [
      day('2026-01-01', [
        { requestId: 'req-a', state: 'missed', label: 'Plan A' },
        { requestId: 'req-a', state: 'skipped', label: 'Plan A' },
      ]),
    ];
    const summary = buildReportSummary({ plans: [plan('req-a', 'Plan A')], history, formatMissedDateTime });
    expect(summary.missedRows).toHaveLength(1);
    expect(summary.missedRows[0].label).toBe('Plan A');
    expect(summary.missedRows[0].dateLabel).toBe(formatMissedDateTime(summary.missedRows[0].scheduledAt));
  });

  it('returns pct 0 with no counted doses', () => {
    const summary = buildReportSummary({ plans: [plan('req-a', 'A')], history: [], formatMissedDateTime });
    expect(summary.pct).toBe(0);
    expect(summary.denominator).toBe(0);
    expect(summary.missedRows).toEqual([]);
  });
});
