import { buildHistory } from './schedule';
import type { MedicationAdministrationResource, MedicationPlan } from './types';

type CsvLocale = 'en' | 'de';

type BuildHistoryCsvArgs = {
  plans: MedicationPlan[];
  events: MedicationAdministrationResource[];
  locale: CsvLocale;
  headers: {
    date: string;
    medication: string;
    time: string;
    status: string;
    actualTime: string;
  };
  statusLabels: {
    taken: string;
    skipped: string;
    missed: string;
  };
  summaryLabel: string;
  now?: Date;
};

const formatDateForCsv = (date: Date, locale: CsvLocale): string => {
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = date.getFullYear().toString();
  return locale === 'de' ? `${dd}.${mm}.${yyyy}` : `${mm}/${dd}/${yyyy}`;
};

const formatTimeForCsv = (date: Date): string => {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
};

const toCsvCell = (value: string): string => {
  if (value.includes('"')) {
    const escaped = value.replaceAll('"', '""');
    return `"${escaped}"`;
  }

  if (value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value}"`;
  }

  return value;
};

const toCsvLine = (cells: string[]): string => cells.map((cell) => toCsvCell(cell)).join(',');

const formatFileDate = (date: Date): string => {
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const buildHistoryCsv = ({
  plans,
  events,
  locale,
  headers,
  statusLabels,
  summaryLabel,
  now,
}: BuildHistoryCsvArgs): { fileName: string; csv: string } => {
  const instant = now ?? new Date();
  const history = buildHistory(plans, events, 14, { now: instant });

  const lines: string[] = [
    toCsvLine([headers.date, headers.medication, headers.time, headers.status, headers.actualTime]),
  ];

  let taken = 0;
  let skipped = 0;
  let missed = 0;

  for (const day of history) {
    for (const dose of day.doses) {
      if (dose.state !== 'taken' && dose.state !== 'skipped' && dose.state !== 'missed') {
        continue;
      }

      const status =
        dose.state === 'taken'
          ? statusLabels.taken
          : dose.state === 'skipped'
            ? statusLabels.skipped
            : statusLabels.missed;

      if (dose.state === 'taken') taken += 1;
      if (dose.state === 'skipped') skipped += 1;
      if (dose.state === 'missed') missed += 1;

      const actualTime = dose.eventTimestamp ? formatTimeForCsv(new Date(dose.eventTimestamp)) : '';

      lines.push(
        toCsvLine([
          formatDateForCsv(day.date, locale),
          dose.label,
          formatTimeForCsv(dose.scheduledAt),
          status,
          actualTime,
        ]),
      );
    }
  }

  const denominator = taken + skipped + missed;
  const adherencePct = denominator > 0 ? Math.round((taken / denominator) * 100) : 0;

  lines.push(toCsvLine([summaryLabel, '', '', `${adherencePct}%`, '']));

  return {
    fileName: `Takt_History_${formatFileDate(instant)}.csv`,
    csv: lines.join('\n'),
  };
};
