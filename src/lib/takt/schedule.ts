import { DEFAULT_GRACE_HOURS, TAKT_EXT } from './constants';
import { addDays, atClockTime, dayCodeFromDate, formatClock, isoDateKey, startOfDay } from './time';
import type {
  DoseOccurrence,
  DoseState,
  MedicationAdministrationResource,
  MedicationPlan,
  PausePeriod,
  SkipReason,
} from './types';

export const localScheduledKey = (value: Date): string => {
  const hours = value.getHours().toString().padStart(2, '0');
  const minutes = value.getMinutes().toString().padStart(2, '0');
  return `${isoDateKey(value)}|${hours}:${minutes}`;
};

const eventKey = (requestRef: string, localKey: string): string => `${requestRef}|${localKey}`;

const eventState = (event: MedicationAdministrationResource): DoseState => {
  if (event.status === 'completed') return 'taken';
  const reason = event.statusReason?.[0]?.coding?.[0]?.code;
  return reason === 'not-available' ? 'missed' : 'skipped';
};

const skipReasonOf = (event?: MedicationAdministrationResource): SkipReason | undefined =>
  event?.statusReason?.[0]?.coding?.find((coding) => coding.system === TAKT_EXT.skipReason)?.code as
    | SkipReason
    | undefined;

const eventTimestamp = (event: MedicationAdministrationResource): number =>
  event.effectiveDateTime ? new Date(event.effectiveDateTime).getTime() : 0;

const indexEvents = (
  events: MedicationAdministrationResource[],
): Map<string, MedicationAdministrationResource> => {
  const map = new Map<string, MedicationAdministrationResource>();
  for (const event of events) {
    const requestRef = event.request?.reference;
    const scheduledRaw = event.extension?.find((x) => x.url === TAKT_EXT.scheduledTime)?.valueDateTime;
    if (!requestRef || !scheduledRaw) continue;

    const scheduledAt = new Date(scheduledRaw);
    if (Number.isNaN(scheduledAt.getTime())) continue;

    const key = eventKey(requestRef, localScheduledKey(scheduledAt));
    const current = map.get(key);

    if (!current || eventTimestamp(event) >= eventTimestamp(current)) {
      map.set(key, event);
    }
  }
  return map;
};

const parseIsoDateTime = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

/** YYYY-MM-DD as local midnight; date-only values must not shift with the timezone. */
export const parseDateOnly = (value?: string): Date | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether the plan has a scheduled dose on this calendar day. As-needed plans never do. */
export const planDueOnDay = (plan: MedicationPlan, day: Date): boolean => {
  if (plan.asNeeded || plan.cadence === 'as-needed') return false;
  if (plan.cadence === 'interval') {
    const every = Math.max(1, plan.intervalDays ?? 1);
    const start = parseDateOnly(plan.intervalStart) ?? parseIsoDateTime(plan.createdAt);
    if (!start) return true;
    // Rounded so a DST change inside the span does not shift the day count.
    const diff = Math.round((startOfDay(day).getTime() - startOfDay(start).getTime()) / DAY_MS);
    return diff >= 0 && diff % every === 0;
  }
  if (plan.dayOfWeek.length === 0) return true;
  return plan.dayOfWeek.includes(dayCodeFromDate(day));
};

/** True once the course end date has passed (the whole end day still counts). */
export const courseEnded = (plan: MedicationPlan, at: Date): boolean => {
  const end = parseDateOnly(plan.endDate);
  return Boolean(end) && at >= addDays(startOfDay(end as Date), 1);
};

const isWithinPausePeriod = (scheduledAt: Date, period: PausePeriod): boolean => {
  const start = parseIsoDateTime(period.start);
  if (!start) return false;
  const end = parseIsoDateTime(period.end);

  if (end) {
    return scheduledAt >= start && scheduledAt < end;
  }

  return scheduledAt >= start;
};

const doseSuppressed = (plan: MedicationPlan, scheduledAt: Date): boolean => {
  const createdAt = parseIsoDateTime(plan.createdAt);
  if (createdAt && scheduledAt < createdAt) {
    return true;
  }

  if (courseEnded(plan, scheduledAt)) {
    return true;
  }

  const archivedAt = parseIsoDateTime(plan.archivedAt);
  if (archivedAt && scheduledAt >= archivedAt) {
    return true;
  }

  if (plan.request.status === 'stopped' && !archivedAt) {
    return true;
  }

  if (plan.pauseHistory.some((period) => isWithinPausePeriod(scheduledAt, period))) {
    return true;
  }

  if (plan.request.status === 'on-hold' && plan.pauseHistory.length === 0) {
    return true;
  }

  return false;
};

export const graceWindowCloseAt = (
  scheduledAt: Date,
  graceHours = DEFAULT_GRACE_HOURS,
): Date => new Date(scheduledAt.getTime() + graceHours * 60 * 60 * 1000);

export const resolveDoseState = (
  scheduledAt: Date,
  now: Date,
  event?: MedicationAdministrationResource,
  graceHours = DEFAULT_GRACE_HOURS,
): DoseState => {
  if (event) {
    return eventState(event);
  }

  const graceLimit = graceWindowCloseAt(scheduledAt, graceHours);
  if (now < scheduledAt) return 'scheduled';
  if (now <= graceLimit) return 'due';
  return 'missed';
};

export const buildDoseOccurrencesForDay = (
  plans: MedicationPlan[],
  events: MedicationAdministrationResource[],
  day: Date,
  now = new Date(),
  graceHours = DEFAULT_GRACE_HOURS,
): DoseOccurrence[] => {
  const indexed = indexEvents(events);
  const doses: DoseOccurrence[] = [];

  for (const plan of plans) {
    if (!planDueOnDay(plan, day)) continue;

    for (const time of plan.times) {
      const scheduledAt = atClockTime(day, time);
      if (doseSuppressed(plan, scheduledAt)) continue;

      const requestRef = `MedicationRequest/${plan.request.id}`;
      const lookup = indexed.get(eventKey(requestRef, localScheduledKey(scheduledAt)));

      const state = resolveDoseState(scheduledAt, now, lookup, graceHours);

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
        reasonCode: skipReasonOf(lookup),
        instruction: plan.instruction,
        instructionNote: plan.instructionNote,
      });
    }
  }

  return doses.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
};

export type AsNeededLog = {
  plan: MedicationPlan;
  /** Doses logged on the day, oldest first, each as a taken occurrence. */
  doses: DoseOccurrence[];
  /** True when `maxPerDay` is set and reached. */
  atMax: boolean;
};

/** As-needed medications are never scheduled and never count toward adherence; this is their day log. */
export const buildAsNeededLogForDay = (
  plans: MedicationPlan[],
  events: MedicationAdministrationResource[],
  day: Date,
): AsNeededLog[] => {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return plans
    .filter((plan) => (plan.asNeeded || plan.cadence === 'as-needed') && plan.request.status === 'active')
    .map((plan) => {
      const requestRef = `MedicationRequest/${plan.request.id}`;
      const doses = events
        .filter((event) => event.request?.reference === requestRef && event.status === 'completed')
        .map((event) => ({ event, at: parseIsoDateTime(event.extension?.find((x) => x.url === TAKT_EXT.scheduledTime)?.valueDateTime ?? event.effectiveDateTime) }))
        .filter((row): row is { event: MedicationAdministrationResource; at: Date } => Boolean(row.at) && (row.at as Date) >= dayStart && (row.at as Date) < dayEnd)
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map<DoseOccurrence>(({ event, at }) => ({
          id: `${plan.request.id}-prn-${event.id}`,
          requestId: plan.request.id,
          medicationRef: plan.request.medicationReference?.reference,
          label: plan.label,
          strength: plan.strength || undefined,
          scheduledAt: at,
          state: 'taken',
          eventId: event.id,
          eventTimestamp: event.effectiveDateTime,
          instruction: plan.instruction,
          instructionNote: plan.instructionNote,
        }));
      return { plan, doses, atMax: typeof plan.maxPerDay === 'number' && doses.length >= plan.maxPerDay };
    });
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

export type BuildHistoryOptions = {
  now?: Date;
  today?: Date;
  /** Hours after the scheduled time before an unlogged dose counts as missed. */
  graceHours?: number;
};

export const buildHistory = (
  plans: MedicationPlan[],
  events: MedicationAdministrationResource[],
  days = 14,
  options?: BuildHistoryOptions,
): HistoryDay[] => {
  const now = options?.now ?? new Date();
  const today = startOfDay(options?.today ?? now);
  const rows: HistoryDay[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    const doses = buildDoseOccurrencesForDay(plans, events, day, now, options?.graceHours);
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
