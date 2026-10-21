import { DateTime } from 'luxon';
import { DEFAULT_GRACE_HOURS, TAKT_EXT } from './constants.js';
import { normalizeReference } from './references.js';
import {
  addDays,
  atClockTime,
  dayCodeFromDate,
  fromTimeOfDay,
  localScheduledKey,
  normalizeWeekdayCodes,
  parseDateOnly,
  parseInstant,
  sortTimes,
  startOfDay,
  toIsoInstant,
  WEEKDAY_ORDER,
  WEEKDAYS_ONLY,
  zoneOrUtc,
} from './time.js';
import type {
  DoseOccurrence,
  DoseState,
  FhirExtension,
  MedicationAdministrationResource,
  MedicationCadence,
  MedicationPlan,
  MedicationRequestResource,
  MedicationResource,
  PausePeriod,
  SkipReason,
  WeekdayCode,
} from './types.js';

const readExtensionString = (extensions: FhirExtension[] | undefined, url: string): string | undefined =>
  extensions?.find((extension) => extension.url === url)?.valueString;

const readExtensionDateTime = (extensions: FhirExtension[] | undefined, url: string): string | undefined =>
  extensions?.find((extension) => extension.url === url)?.valueDateTime;

const readStrength = (medication: MedicationResource | null): string => {
  if (!medication) return '';
  const extension = readExtensionString(medication.extension, TAKT_EXT.strength);
  if (extension) return extension;
  const codeText = medication.code?.text ?? '';
  const match = codeText.match(/\b(\d+\s?(mg|mcg|µg|g|ml))\b/i);
  return match?.[1] ?? '';
};

const readPauseHistory = (request: MedicationRequestResource): PausePeriod[] => {
  const raw = readExtensionString(request.extension, TAKT_EXT.pauseHistory);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PausePeriod => {
        if (!item || typeof item !== 'object') return false;
        const candidate = item as { start?: unknown; end?: unknown };
        if (typeof candidate.start !== 'string') return false;
        if (candidate.end !== undefined && typeof candidate.end !== 'string') return false;
        return true;
      })
      .map((item) => ({ start: item.start, end: item.end }))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  } catch {
    return [];
  }
};

const readCreatedAt = (request: MedicationRequestResource, zone: string): string | undefined => {
  const extension = readExtensionDateTime(request.extension, TAKT_EXT.requestCreatedAt);
  if (extension) return extension;
  if (!request.authoredOn) return undefined;
  const parsed = DateTime.fromISO(request.authoredOn, { zone });
  return parsed.isValid ? toIsoInstant(parsed) : undefined;
};

const readTimes = (request: MedicationRequestResource): string[] => {
  if (request.dosageInstruction?.[0]?.asNeededBoolean) return [];
  const times = request.dosageInstruction?.[0]?.timing?.repeat?.timeOfDay ?? [];
  if (times.length === 0) return ['08:00'];
  return sortTimes(times.map(fromTimeOfDay));
};

const readDayOfWeek = (request: MedicationRequestResource): WeekdayCode[] => {
  const days = request.dosageInstruction?.[0]?.timing?.repeat?.dayOfWeek ?? [];
  if (days.length === 0) return WEEKDAY_ORDER;
  const normalized = normalizeWeekdayCodes(days);
  return normalized.length > 0 ? normalized : WEEKDAY_ORDER;
};

const readCadence = (request: MedicationRequestResource, dayOfWeek: WeekdayCode[]): MedicationCadence => {
  const dosage = request.dosageInstruction?.[0];
  if (dosage?.asNeededBoolean) return 'as-needed';
  const period = dosage?.timing?.repeat?.period ?? 1;
  const periodUnit = (dosage?.timing?.repeat?.periodUnit ?? 'd').toLowerCase();
  if (period > 1 && ['d', 'day', 'days'].includes(periodUnit)) return 'interval';
  if (['wk', 'week', 'weeks'].includes(periodUnit)) return 'interval';
  if (dayOfWeek.length === WEEKDAY_ORDER.length) return 'daily';
  if (dayOfWeek.length === WEEKDAYS_ONLY.length && WEEKDAYS_ONLY.every((day, index) => dayOfWeek[index] === day)) {
    return 'weekdays';
  }
  return 'custom';
};

const readIntervalDays = (request: MedicationRequestResource): number | undefined => {
  const repeat = request.dosageInstruction?.[0]?.timing?.repeat;
  if (!repeat) return undefined;
  const period = repeat.period ?? 1;
  const unit = (repeat.periodUnit ?? 'd').toLowerCase();
  return ['wk', 'week', 'weeks'].includes(unit) ? period * 7 : period;
};

const readDateOnly = (value: string | undefined, zone: string): string | undefined => {
  if (!value) return undefined;
  const parsed = DateTime.fromISO(value, { zone });
  return parsed.isValid ? parsed.toFormat('yyyy-MM-dd') : value.slice(0, 10);
};

export const readPlan = (
  request: MedicationRequestResource,
  medication: MedicationResource | null,
  zone = 'UTC',
): MedicationPlan => {
  const dosage = request.dosageInstruction?.[0];
  const repeat = dosage?.timing?.repeat;
  const dayOfWeek = readDayOfWeek(request);
  const cadence = readCadence(request, dayOfWeek);
  return {
    request,
    medication,
    label: medication?.code?.text ?? request.medicationReference?.display ?? 'Medication',
    form: medication?.form?.text ?? '',
    strength: readStrength(medication),
    times: readTimes(request),
    cadence,
    dayOfWeek,
    intervalDays: cadence === 'interval' ? readIntervalDays(request) : undefined,
    intervalStart:
      cadence === 'interval' ? readDateOnly(repeat?.boundsPeriod?.start, zone) : undefined,
    startDate: readExtensionString(request.extension, TAKT_EXT.startDate)?.slice(0, 10),
    endDate: readDateOnly(repeat?.boundsPeriod?.end, zone),
    asNeeded: cadence === 'as-needed',
    maxPerDay: dosage?.maxDosePerPeriod?.numerator?.value,
    createdAt: readCreatedAt(request, zone),
    archivedAt: readExtensionDateTime(request.extension, TAKT_EXT.archivedAt),
    pauseHistory: readPauseHistory(request),
    status: request.status,
  };
};

export const planDueOnDay = (plan: MedicationPlan, day: DateTime, zone = 'UTC'): boolean => {
  if (plan.asNeeded || plan.cadence === 'as-needed') return false;
  const dayStart = startOfDay(day, zone);
  const regimenStart = parseDateOnly(plan.startDate, zone);
  if (regimenStart && dayStart < regimenStart) return false;

  if (plan.cadence === 'interval') {
    const every = Math.max(1, plan.intervalDays ?? 1);
    const start = parseDateOnly(plan.intervalStart, zone) ?? (plan.createdAt ? parseInstant(plan.createdAt, zone) : null);
    if (!start) return true;
    const diff = Math.round(dayStart.diff(start.startOf('day'), 'days').days);
    return diff >= 0 && diff % every === 0;
  }

  if (plan.dayOfWeek.length === 0) return true;
  return plan.dayOfWeek.includes(dayCodeFromDate(dayStart, zone));
};

export const courseEnded = (plan: MedicationPlan, at: DateTime, zone = 'UTC'): boolean => {
  const end = parseDateOnly(plan.endDate, zone);
  if (!end) return false;
  return at >= addDays(end, 1);
};

const isWithinPausePeriod = (scheduledAt: DateTime, period: PausePeriod, zone: string): boolean => {
  const start = parseInstant(period.start, zone);
  if (!start) return false;
  const end = period.end ? parseInstant(period.end, zone) : null;
  if (end) return scheduledAt >= start && scheduledAt < end;
  return scheduledAt >= start;
};

export const doseSuppressed = (plan: MedicationPlan, scheduledAt: DateTime, zone = 'UTC'): boolean => {
  const createdAt = plan.createdAt ? parseInstant(plan.createdAt, zone) : null;
  if (createdAt && scheduledAt < createdAt) return true;

  const regimenStart = parseDateOnly(plan.startDate, zone);
  if (regimenStart && scheduledAt < regimenStart) return true;

  if (courseEnded(plan, scheduledAt, zone)) return true;

  const archivedAt = plan.archivedAt ? parseInstant(plan.archivedAt, zone) : null;
  if (archivedAt && scheduledAt >= archivedAt) return true;

  if (plan.request.status !== 'active' && plan.request.status !== 'on-hold') return true;

  if (plan.pauseHistory.some((period) => isWithinPausePeriod(scheduledAt, period, zone))) return true;

  if (plan.request.status === 'on-hold') return true;

  return false;
};

const eventState = (event: MedicationAdministrationResource): DoseState => {
  if (event.status === 'completed') return 'taken';
  const reason = event.statusReason?.[0]?.coding?.[0]?.code;
  return reason === 'not-available' ? 'missed' : 'skipped';
};

const skipReasonOf = (event?: MedicationAdministrationResource): SkipReason | undefined =>
  event?.statusReason?.[0]?.coding?.find((coding) => coding.system === TAKT_EXT.skipReason)?.code as SkipReason | undefined;

const eventTimestamp = (event: MedicationAdministrationResource): number =>
  event.effectiveDateTime ? new Date(event.effectiveDateTime).getTime() : 0;

const eventKey = (requestRef: string, localKey: string): string => `${requestRef}|${localKey}`;

const indexEvents = (
  events: MedicationAdministrationResource[],
  zone: string,
): Map<string, MedicationAdministrationResource> => {
  const map = new Map<string, MedicationAdministrationResource>();
  for (const event of events) {
    const requestRef = normalizeReference(event.request?.reference);
    const scheduledRaw = event.extension?.find((extension) => extension.url === TAKT_EXT.scheduledTime)?.valueDateTime;
    if (!requestRef || !scheduledRaw) continue;
    const scheduled = parseInstant(scheduledRaw, zone);
    if (!scheduled) continue;
    const key = eventKey(requestRef, localScheduledKey(scheduled, zone));
    const current = map.get(key);
    if (!current || eventTimestamp(event) >= eventTimestamp(current)) {
      map.set(key, event);
    }
  }
  return map;
};

export const resolveDoseState = (
  scheduledAt: DateTime,
  now: DateTime,
  event?: MedicationAdministrationResource,
  graceHours = DEFAULT_GRACE_HOURS,
): DoseState => {
  if (event) return eventState(event);
  const graceLimit = scheduledAt.plus({ hours: graceHours });
  if (now < scheduledAt) return 'scheduled';
  if (now <= graceLimit) return 'due';
  return 'missed';
};

export const buildDoseOccurrencesForDay = (
  plans: MedicationPlan[],
  events: MedicationAdministrationResource[],
  day: DateTime,
  now: DateTime,
  zone = 'UTC',
  graceHours = DEFAULT_GRACE_HOURS,
): DoseOccurrence[] => {
  const dayStart = startOfDay(day, zone);
  const indexed = indexEvents(events, zone);
  const doses: DoseOccurrence[] = [];

  for (const plan of plans) {
    if (!plan.request.id) continue;
    if (!planDueOnDay(plan, dayStart, zone)) continue;

    for (const time of plan.times) {
      const scheduledAt = atClockTime(dayStart, time, zone);
      if (doseSuppressed(plan, scheduledAt, zone)) continue;

      const requestRef = `MedicationRequest/${plan.request.id}`;
      const localKey = localScheduledKey(scheduledAt, zone);
      const lookup = indexed.get(eventKey(requestRef, localKey));
      const state = resolveDoseState(scheduledAt, now, lookup, graceHours);

      doses.push({
        id: `${plan.request.id}-${toIsoInstant(scheduledAt)}`,
        requestId: plan.request.id,
        medicationRef: plan.request.medicationReference?.reference,
        label: plan.label,
        strength: plan.strength || undefined,
        scheduledAt: toIsoInstant(scheduledAt),
        state,
        eventId: lookup?.id,
        reasonCode: skipReasonOf(lookup),
      });
    }
  }

  return doses.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
};

export const buildDoseOccurrencesForDays = (
  plans: MedicationPlan[],
  events: MedicationAdministrationResource[],
  days: DateTime[],
  now: DateTime,
  zone = 'UTC',
  graceHours = DEFAULT_GRACE_HOURS,
): DoseOccurrence[] =>
  days
    .flatMap((day) => buildDoseOccurrencesForDay(plans, events, day, now, zone, graceHours))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

export const patientTimezone = (
  patient: { extension?: FhirExtension[] },
  fallbackZone = 'UTC',
): string => {
  const safeFallback = DateTime.now().setZone(fallbackZone).isValid ? fallbackZone : 'UTC';
  const zone = zoneOrUtc(readExtensionString(patient.extension, TAKT_EXT.patientTimezone) ?? safeFallback);
  return DateTime.now().setZone(zone).isValid ? zone : safeFallback;
};
