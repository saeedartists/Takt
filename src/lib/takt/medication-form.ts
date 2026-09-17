import { sortTimes, WEEKDAY_ORDER, WEEKDAYS_ONLY } from './time';
import type { MedicationCadence, WeekdayCode } from './types';

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
};

export type MedicationFormErrors = Partial<Record<'name' | 'times' | 'days' | 'lastRefilled', string>>;

export const FORM_PRESETS = ['Tablet', 'Capsule', 'Drops', 'Inhaler', 'Syrup'] as const;
export const TIME_PRESETS = ['08:00', '12:00', '18:00', '22:00'];
export const SUPPLY_PRESETS = ['14', '28', '30', '60', '90'];

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
  cadence === 'daily' ? WEEKDAY_ORDER : cadence === 'weekdays' ? WEEKDAYS_ONLY : days;

export const validateMedicationForm = (
  values: MedicationFormValues,
  t: (key: 'addMedicationNameError' | 'invalidTimesError' | 'selectAtLeastOneDayError' | 'supplyLastRefilledInvalid') => string,
): MedicationFormErrors => {
  const errors: MedicationFormErrors = {};
  if (!values.name.trim()) errors.name = t('addMedicationNameError');
  if (values.times.length === 0 || !values.times.every(isClockTime)) errors.times = t('invalidTimesError');
  if (values.cadence === 'custom' && values.days.length === 0) errors.days = t('selectAtLeastOneDayError');
  if (values.lastRefilled.trim() && !normalizeDateInput(values.lastRefilled)) {
    errors.lastRefilled = t('supplyLastRefilledInvalid');
  }
  return errors;
};
