import { isoDateKey, sortTimes, WEEKDAY_ORDER, WEEKDAYS_ONLY } from './time';
import type { IntakeInstruction, MedicationCadence, MedicationPlan, MedicationShape, MedicationUnit, WeekdayCode } from './types';

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
  /** Unit chosen for `strength` (mg, ml, …); '' when the stored strength had none. */
  unit: MedicationUnit | '';
  /** Per-intake amount as text ("" when not set); validated via parseDosageQuantity. */
  dosageQuantity: string;
  /** Unit chosen for `dosageQuantity` (tablets, tsp, …). */
  dosageUnit: MedicationUnit | '';
  times: string[];
  cadence: MedicationCadence;
  days: WeekdayCode[];
  supply: string;
  status: MedicationStatus;
  /** YYYY-MM-DD or '' */
  lastRefilled: string;
  /** First day the regimen is active, YYYY-MM-DD or ''. Empty = no start gate. */
  startDate: string;
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
  Record<
    'name' | 'times' | 'days' | 'lastRefilled' | 'interval' | 'endDate' | 'maxPerDay' | 'startDate' | 'dosageQuantity',
    string
  >
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

/* ---- Standard units (chosen from a selector, never free text) ---- */

/** Locale keys for the standard units; must exist in every locale file. */
export type UnitLabelKey =
  | 'unitMg' | 'unitMcg' | 'unitG' | 'unitMl' | 'unitTablets' | 'unitCapsules' | 'unitDrops'
  | 'unitTsp' | 'unitTbsp' | 'unitPuffs' | 'unitSprays' | 'unitUnits' | 'unitOther';

/** Locale key per standard unit; `MEDICATION_UNIT_LABELS[unit]` feeds `t(...)`. */
export const MEDICATION_UNIT_LABELS: Record<MedicationUnit, UnitLabelKey> = {
  mg: 'unitMg',
  mcg: 'unitMcg',
  'µg': 'unitMcg',
  g: 'unitG',
  ml: 'unitMl',
  tablets: 'unitTablets',
  capsules: 'unitCapsules',
  drops: 'unitDrops',
  tsp: 'unitTsp',
  tbsp: 'unitTbsp',
  puffs: 'unitPuffs',
  sprays: 'unitSprays',
  units: 'unitUnits',
  other: 'unitOther',
};

/** Units the strength can be expressed in (e.g. mg, ml). */
export const STRENGTH_UNIT_OPTIONS: MedicationUnit[] = ['mg', 'mcg', 'µg', 'g', 'ml', 'units'];
/** Units for the per-intake amount (e.g. 2 tablets, 2 teaspoons). */
export const DOSAGE_UNIT_OPTIONS: MedicationUnit[] = ['tablets', 'capsules', 'drops', 'tsp', 'tbsp', 'puffs', 'sprays', 'ml', 'units', 'other'];

export const DEFAULT_UNIT: MedicationUnit = 'mg';
export const DEFAULT_DOSAGE_UNIT: MedicationUnit = 'tablets';

const UNIT_KEYS = Object.keys(MEDICATION_UNIT_LABELS) as string[];

export const isStandardUnit = (value: string): value is MedicationUnit => UNIT_KEYS.includes(value);

/** Stored strength is one string ("5 mg"); the form keeps value and unit apart. */
export const splitStrength = (raw: string): { strength: string; unit: MedicationUnit | '' } => {
  const trimmed = raw.trim();
  const match = /^(.+?)\s+(\S+)$/.exec(trimmed);
  if (match && isStandardUnit(match[2]) && match[2] !== 'other') {
    return { strength: match[1], unit: match[2] };
  }
  return { strength: trimmed, unit: '' };
};

/** Value + chosen unit → the stored strength string ("5" + mg → "5 mg"). */
export const formatStrength = (strength: string, unit: MedicationUnit | ''): string => {
  const trimmed = strength.trim();
  if (!unit || unit === 'other') return trimmed;
  // Only a bare number gets the unit appended; a typed value ("1000 IU", "5 mg") stands as is.
  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return trimmed;
  return `${trimmed} ${unit}`;
};

/** Decimal-friendly: doses like 0.5 tablets are valid, 0 and text are not. */
export const parseDosageQuantity = (raw: string): number | undefined => {
  const normalized = raw.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return parsed > 0 ? parsed : undefined;
};

/** Stored dosage is "2 tablets"; the form keeps quantity and unit apart. */
export const splitDosage = (raw: string): { dosageQuantity: string; dosageUnit: MedicationUnit | '' } => {
  const match = /^(\d+(?:\.\d+)?)\s+(\S+)$/.exec(raw.trim());
  // `other` must survive the round trip too: the mutation writes it verbatim ("2 other").
  if (match && isStandardUnit(match[2])) {
    return { dosageQuantity: match[1], dosageUnit: match[2] };
  }
  const quantity = parseDosageQuantity(raw);
  return { dosageQuantity: quantity !== undefined ? String(quantity) : raw.trim(), dosageUnit: '' };
};

export const EMPTY_MEDICATION_FORM: MedicationFormValues = {
  name: '',
  form: 'Tablet',
  strength: '5',
  unit: DEFAULT_UNIT,
  dosageQuantity: '',
  dosageUnit: DEFAULT_DOSAGE_UNIT,
  times: ['08:00'],
  cadence: 'daily',
  days: WEEKDAYS_ONLY,
  supply: '28',
  status: 'active',
  lastRefilled: '',
  startDate: '',
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
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const asDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  // Round-trip check in UTC: Feb 30 would otherwise silently roll into March.
  if (Number.isNaN(asDate.getTime()) || asDate.getUTCMonth() !== month - 1 || asDate.getUTCDate() !== day) {
    return null;
  }
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
  // An interval plan without its own anchor starts with the regimen, not with the day it was created.
  intervalStart:
    values.cadence === 'interval'
      ? values.intervalStart.trim() || values.startDate.trim() || isoDateKey(new Date())
      : undefined,
  startDate: values.startDate.trim() || undefined,
  endDate: values.endDate.trim() || undefined,
  asNeeded: values.cadence === 'as-needed',
  maxPerDay: values.cadence === 'as-needed' ? toPositiveInt(values.maxPerDay) : undefined,
  dosageQuantity: parseDosageQuantity(values.dosageQuantity),
  dosageUnit: parseDosageQuantity(values.dosageQuantity) ? values.dosageUnit || DEFAULT_DOSAGE_UNIT : undefined,
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
      | 'maxPerDayError'
      | 'startDateError'
      | 'startDateAfterEndDateError'
      | 'dosageQuantityError',
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
  const startDate = values.startDate.trim();
  const endDate = values.endDate.trim();
  if (startDate && !normalizeDateInput(startDate)) errors.startDate = t('startDateError');
  // A regimen that starts after it ends would silently produce zero doses forever.
  if (!errors.startDate && startDate && endDate && normalizeDateInput(endDate) && startDate > endDate) {
    errors.startDate = t('startDateAfterEndDateError');
  }
  if (values.dosageQuantity.trim() && !parseDosageQuantity(values.dosageQuantity)) errors.dosageQuantity = t('dosageQuantityError');
  if (endDate && !normalizeDateInput(endDate)) errors.endDate = t('endDateError');
  if (asNeeded && values.maxPerDay.trim() && !toPositiveInt(values.maxPerDay)) errors.maxPerDay = t('maxPerDayError');
  if (values.lastRefilled.trim() && !normalizeDateInput(values.lastRefilled)) {
    errors.lastRefilled = t('supplyLastRefilledInvalid');
  }
  return errors;
};
