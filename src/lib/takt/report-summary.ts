import type { HistoryDay } from './schedule';
import type { MedicationPlan } from './types';

export type ReportMedicationSummary = {
  id: string;
  label: string;
  pct: number;
  taken: number;
  denominator: number;
};

export type ReportMissedSummary = {
  requestId: string;
  label: string;
  scheduledAt: Date;
  dateLabel: string;
};

export type ReportSummary = {
  pct: number;
  taken: number;
  denominator: number;
  byMedication: ReportMedicationSummary[];
  missedRows: ReportMissedSummary[];
};

const safePct = (taken: number, denominator: number): number =>
  denominator > 0 ? Math.round((taken / denominator) * 100) : 0;

export const buildReportSummary = (input: {
  plans: MedicationPlan[];
  history: HistoryDay[];
  formatMissedDateTime: (value: Date) => string;
}): ReportSummary => {
  const byRequest = new Map<string, { label: string; taken: number; denominator: number }>();

  for (const plan of input.plans) {
    byRequest.set(plan.request.id, {
      label: plan.label,
      taken: 0,
      denominator: 0,
    });
  }

  const missedRows: ReportMissedSummary[] = [];

  for (const day of input.history) {
    for (const dose of day.doses) {
      const entry = byRequest.get(dose.requestId);
      if (!entry) continue;

      if (dose.state === 'taken') {
        entry.taken += 1;
        entry.denominator += 1;
      } else if (dose.state === 'skipped' || dose.state === 'missed') {
        entry.denominator += 1;
      }

      if (dose.state === 'missed') {
        missedRows.push({
          requestId: dose.requestId,
          label: dose.label,
          scheduledAt: dose.scheduledAt,
          dateLabel: input.formatMissedDateTime(dose.scheduledAt),
        });
      }
    }
  }

  const byMedication = input.plans.map((plan) => {
    const row = byRequest.get(plan.request.id);
    const taken = row?.taken ?? 0;
    const denominator = row?.denominator ?? 0;

    return {
      id: plan.request.id,
      label: row?.label ?? plan.label,
      pct: safePct(taken, denominator),
      taken,
      denominator,
    };
  });

  const taken = byMedication.reduce((sum, row) => sum + row.taken, 0);
  const denominator = byMedication.reduce((sum, row) => sum + row.denominator, 0);

  return {
    pct: safePct(taken, denominator),
    taken,
    denominator,
    byMedication,
    missedRows,
  };
};
