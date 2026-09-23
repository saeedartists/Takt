import { isoDateKey, sortTimes, WEEKDAY_ORDER, WEEKDAYS_ONLY } from './time';
import type { IntakeInstruction, MedicationCadence, MedicationPlan, MedicationShape, WeekdayCode } from './types';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isClockTime = (value: string): boolean => TIME_PATTERN.test(value);

export const parseTimeList = (raw: string): string[] => {
  const tokens = raw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  const normalized = tokens.map((token) => {
    if (!TIME_PATTERN.test(token)) return null;
    return token;
  });

  if (normalized.some((value) => value === null)) return [];

  const unique = [...new Set(normalized as string[])];
  return sortTimes(unique);
};

export const normalizeTimesInput = (raw: string): string => {
  const times = parseTimeList(raw);
  return times.join(', ');
};

export const formatDayLabel = (
  day: WeekdayCode,
  t: (key: 'dayMon' | 'dayTue' | 'dayWed' | 'dayThu' | 'dayFri' | 'daySat' | 'daySun') => string,
): string => {
  if (day === 'mon') return t('dayMon');
  if (day === 'tue') return t('dayTue');
  if (day === 'wed') return t('dayWed');
  if (day === 'thu') return t('dayThu');
  if (day === 'fri') return t('dayFri');
  if (day === 'sat') return t('daySat');
  return t('daySun');
};

type CadenceLabelKey =
  | 'cadenceDaily'
  | 'cadenceWeekdays'
  | 'cadenceEveryDays'
  | 'cadenceAsNeeded'
  | 'dayMon'
  | 'dayTue'
  | 'dayWed'
  | 'dayThu'
  | 'dayFri'
  | 'daySat'
  | 'daySun';

export const SHAPE_LABEL_KEY: Record<MedicationShape, 'shapeRound' | 'shapeOval' | 'shapeCapsule' | 'shapeDrops' | 'shapeInhaler' | 'shapeInjection' | 'shapeOther'> = {
  round: 'shapeRound',
  oval: 'shapeOval',
  capsule: 'shapeCapsule',
  drops: 'shapeDrops',
  inhaler: 'shapeInhaler',
  injection: 'shapeInjection',
  other: 'shapeOther',
};

export const INSTRUCTION_LABEL_KEY: Record<IntakeInstruction, 'instructionWithFood' | 'instructionEmptyStomach' | 'instructionBeforeBed'> = {
  'with-food': 'instructionWithFood',
  'empty-stomach': 'instructionEmptyStomach',
  'before-bed': 'instructionBeforeBed',
};

/** "With food · with a glass of water": the chosen instruction plus the free-text note, or undefined. */
export const describeInstruction = (
  plan: { instruction?: IntakeInstruction; instructionNote?: string },
  t: (key: 'instructionWithFood' | 'instructionEmptyStomach' | 'instructionBeforeBed') => string,
): string | undefined => {
  const parts = [plan.instruction ? t(INSTRUCTION_LABEL_KEY[plan.instruction]) : undefined, plan.instructionNote].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
};

/** One sentence for how often a plan runs: "Daily", "Every 2 days", "Mon, Wed, Fri", "As needed". */
export const describeCadence = (
  plan: Pick<MedicationPlan, 'cadence' | 'dayOfWeek' | 'intervalDays'>,
  t: (key: CadenceLabelKey) => string,
): string => {
  if (plan.cadence === 'as-needed') return t('cadenceAsNeeded');
  if (plan.cadence === 'interval') return t('cadenceEveryDays').replace('{days}', String(plan.intervalDays ?? 2));
  if (plan.cadence === 'daily') return t('cadenceDaily');
  if (plan.cadence === 'weekdays') return t('cadenceWeekdays');
  return plan.dayOfWeek.map((day) => formatDayLabel(day, t)).join(', ');
};

/* ---- Shared form model (new + edit) ---- */

export type MedicationStatus = 'active' | 'on-hold' | 'stopped';

export type MedicationFormValues = {
  name: string;
  /** Stored form text; presets stay English so existing FHIR records keep matching. */
  form: string;
  strength: string;
  times: string[];
  cadence: MedicationCadence;
  days: WeekdayCode[];
  supply: string;
  status: MedicationStatus;
  /** YYYY-MM-DD or '' */
  lastRefilled: string;
  /** Cadence 'interval': every N days from `intervalStart` (YYYY-MM-DD, '' = today). */
  intervalDays: string;
  intervalStart: string;
  /** Last day of a course, YYYY-MM-DD or ''. */
  endDate: string;
  /** As-needed cap, '' = none. */
  maxPerDay: string;
  instruction: IntakeInstruction | '';
  instructionNote: string;
  shape: MedicationShape;
  color: string;
};

export type MedicationFormErrors = Partial<
  Record<'name' | 'times' | 'days' | 'lastRefilled' | 'interval' | 'endDate' | 'maxPerDay', string>
>;

export const FORM_PRESETS = ['Tablet', 'Capsule', 'Drops', 'Inhaler', 'Syrup'] as const;
export const TIME_PRESETS = ['08:00', '12:00', '18:00', '22:00'];
export const SUPPLY_PRESETS = ['14', '28', '30', '60', '90'];
export const INTERVAL_PRESETS = ['2', '3', '7', '14'];
export const INSTRUCTION_OPTIONS: IntakeInstruction[] = ['with-food', 'empty-stomach', 'before-bed'];
export const SHAPE_OPTIONS: MedicationShape[] = ['round', 'oval', 'capsule', 'drops', 'inhaler', 'injection', 'other'];
/** Real tablet colours for identification, not UI accents. */
export const COLOR_OPTIONS = ['#F1ECE2', '#E9C46A', '#E07D2C', '#C0392B', '#E8A0BF', '#4A78C2', '#3F8F5F', '#8B5E3C', '#8E8E93'];
export const DEFAULT_COLOR = COLOR_OPTIONS[0];

export const EMPTY_MEDICATION_FORM: MedicationFormValues = {
  name: '',
  form: 'Tablet',
  strength: '5 mg',
  times: ['08:00'],
  cadence: 'daily',
  days: WEEKDAYS_ONLY,
  supply: '28',
  status: 'active',
  lastRefilled: '',
  intervalDays: '2',
  intervalStart: '',
  endDate: '',
  maxPerDay: '',
  instruction: '',
  instructionNote: '',
  shape: 'round',
  color: DEFAULT_COLOR,
};

/** YYYY-MM-DD → ISO at UTC noon (date-only inputs must not shift across timezones). */
export const normalizeDateInput = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const asDate = new Date(`${trimmed}T12:00:00.000Z`);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate.toISOString();
};

export const parseSupply = (raw: string): number | undefined => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export const resolveDayOfWeek = (cadence: MedicationCadence, days: WeekdayCode[]): WeekdayCode[] =>
  cadence === 'custom' ? days : cadence === 'weekdays' ? WEEKDAYS_ONLY : WEEKDAY_ORDER;

const toPositiveInt = (raw: string): number | undefined => {
  if (!/^\d+$/.test(raw.trim())) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return parsed > 0 ? parsed : undefined;
};

/** Form values → the fields the plan mutation needs beyond name/form/strength/times. */
export const scheduleFieldsFromForm = (values: MedicationFormValues) => ({
  cadence: values.cadence,
  dayOfWeek: resolveDayOfWeek(values.cadence, values.days),
  times: values.cadence === 'as-needed' ? [] : values.times,
  intervalDays: values.cadence === 'interval' ? toPositiveInt(values.intervalDays) : undefined,
  intervalStart: values.cadence === 'interval' ? (values.intervalStart.trim() || isoDateKey(new Date())) : undefined,
  endDate: values.endDate.trim() || undefined,
  asNeeded: values.cadence === 'as-needed',
  maxPerDay: values.cadence === 'as-needed' ? toPositiveInt(values.maxPerDay) : undefined,
  instruction: values.instruction || undefined,
  instructionNote: values.instructionNote.trim() || undefined,
  appearance: { shape: values.shape, color: values.color },
});

export const validateMedicationForm = (
  values: MedicationFormValues,
  t: (
    key:
      | 'addMedicationNameError'
      | 'invalidTimesError'
      | 'selectAtLeastOneDayError'
      | 'supplyLastRefilledInvalid'
      | 'intervalDaysError'
      | 'endDateError'
      | 'maxPerDayError',
  ) => string,
): MedicationFormErrors => {
  const errors: MedicationFormErrors = {};
  const asNeeded = values.cadence === 'as-needed';
  if (!values.name.trim()) errors.name = t('addMedicationNameError');
  if (!asNeeded && (values.times.length === 0 || !values.times.every(isClockTime))) errors.times = t('invalidTimesError');
  if (values.cadence === 'custom' && values.days.length === 0) errors.days = t('selectAtLeastOneDayError');
  if (values.cadence === 'interval') {
    const every = toPositiveInt(values.intervalDays);
    if (!every || every < 2 || every > 90 || (values.intervalStart.trim() && !normalizeDateInput(values.intervalStart))) {
      errors.interval = t('intervalDaysError');
    }
  }
  if (values.endDate.trim() && !normalizeDateInput(values.endDate)) errors.endDate = t('endDateError');
  if (asNeeded && values.maxPerDay.trim() && !toPositiveInt(values.maxPerDay)) errors.maxPerDay = t('maxPerDayError');
  if (values.lastRefilled.trim() && !normalizeDateInput(values.lastRefilled)) {
    errors.lastRefilled = t('supplyLastRefilledInvalid');
  }
  return errors;
};
