import { DEFAULT_GRACE_HOURS, TAKT_EXT } from './constants';
import { addDays, atClockTime, dayCodeFromDate, formatClock, isoDateKey, startOfDay } from './time';
import type {
  DoseOccurrence,
  DoseState,
  MedicationAdministrationResource,
  MedicationPlan,
} from './types';

const eventKey = (requestRef: string, scheduledIso: string): string =>
  `${requestRef}|${scheduledIso}`;

const eventState = (event: MedicationAdministrationResource): DoseState => {
  if (event.status === 'completed') return 'taken';
  const reason = event.statusReason?.[0]?.coding?.[0]?.code;
  return reason === 'not-available' ? 'missed' : 'skipped';
};

const requestIsDueOnDay = (plan: MedicationPlan, day: Date): boolean => {
  if (plan.request.status === 'stopped') return false;
  if (plan.dayOfWeek.length === 0) return true;
  return plan.dayOfWeek.includes(dayCodeFromDate(day));
};

const indexEvents = (
  events: MedicationAdministrationResource[],
): Map<string, MedicationAdministrationResource> => {
  const map = new Map<string, MedicationAdministrationResource>();
  for (const event of events) {
    const requestRef = event.request?.reference;
    const scheduled = event.extension?.find((x) => x.url === TAKT_EXT.scheduledTime)?.valueDateTime;
    if (!requestRef || !scheduled) continue;
    map.set(eventKey(requestRef, scheduled), event);
  }
  return map;
};

export const buildDoseOccurrencesForDay = (
  plans: MedicationPlan[],
  events: MedicationAdministrationResource[],
  day: Date,
  now = new Date(),
): DoseOccurrence[] => {
  const indexed = indexEvents(events);
  const doses: DoseOccurrence[] = [];

  for (const plan of plans) {
    if (plan.request.status === 'on-hold') continue;
    if (!requestIsDueOnDay(plan, day)) continue;

    for (const time of plan.times) {
      const scheduledAt = atClockTime(day, time);
      const requestRef = `MedicationRequest/${plan.request.id}`;
      const lookup = indexed.get(eventKey(requestRef, scheduledAt.toISOString()));

      let state: DoseState = 'scheduled';
      if (lookup) {
        state = eventState(lookup);
      } else {
        const graceLimit = new Date(scheduledAt.getTime() + DEFAULT_GRACE_HOURS * 60 * 60 * 1000);
        if (now >= scheduledAt && now <= graceLimit) {
          state = 'due';
        } else if (now > graceLimit) {
          state = 'missed';
        }
      }

      doses.push({
        id: `${plan.request.id}-${scheduledAt.toISOString()}`,
        requestId: plan.request.id,
        medicationRef: plan.request.medicationReference?.reference,
        label: plan.label,
        strength: plan.strength || undefined,
        scheduledAt,
        state,
        eventId: lookup?.id,
        eventTimestamp: lookup?.effectiveDateTime,
      });
    }
  }

  return doses.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
};

export const adherenceSummary = (doses: DoseOccurrence[]) => {
  const taken = doses.filter((d) => d.state === 'taken').length;
  const denominator = doses.filter((d) => ['taken', 'skipped', 'missed'].includes(d.state)).length;
  const pct = denominator === 0 ? 0 : Math.round((taken / denominator) * 100);
  return { taken, denominator, pct };
};

export type HistoryDay = {
  date: Date;
  key: string;
  taken: number;
  skipped: number;
  missed: number;
  adherencePct: number;
  doses: DoseOccurrence[];
};

export const buildHistory = (
  plans: MedicationPlan[],
  events: MedicationAdministrationResource[],
  days = 14,
): HistoryDay[] => {
  const today = startOfDay(new Date());
  const rows: HistoryDay[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    const doses = buildDoseOccurrencesForDay(plans, events, day, new Date());
    const taken = doses.filter((d) => d.state === 'taken').length;
    const skipped = doses.filter((d) => d.state === 'skipped').length;
    const missed = doses.filter((d) => d.state === 'missed').length;
    const denominator = taken + skipped + missed;
    rows.push({
      date: day,
      key: isoDateKey(day),
      taken,
      skipped,
      missed,
      adherencePct: denominator > 0 ? Math.round((taken / denominator) * 100) : 0,
      doses,
    });
  }
  return rows;
};

export const explainDoseState = (state: DoseState): string => {
  switch (state) {
    case 'taken':
      return 'Taken';
    case 'skipped':
      return 'Skipped';
    case 'missed':
      return 'Missed';
    case 'due':
      return 'Due';
    default:
      return 'Scheduled';
  }
};

export const upcomingCount = (doses: DoseOccurrence[]): number =>
  doses.filter((d) => d.state === 'scheduled' || d.state === 'due').length;

export const doseSubtitle = (dose: DoseOccurrence): string => {
  const time = formatClock(dose.scheduledAt);
  return dose.strength ? `${time} · ${dose.strength}` : time;
};
