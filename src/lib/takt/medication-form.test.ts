import { describe, expect, it } from 'vitest';

import {
  formatStrength,
  isClockTime,
  normalizeDateInput,
  normalizeTimesInput,
  parseDosageQuantity,
  parseSupply,
  parseTimeList,
  resolveDayOfWeek,
  scheduleFieldsFromForm,
  splitDosage,
  splitStrength,
  validateMedicationForm,
} from './medication-form';
import type { MedicationFormValues } from './medication-form';

const WEEKDAY_FULL = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const WEEKDAY_MON_FRI = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;

describe('isClockTime / parseTimeList', () => {
  it('accepts strict 24h clock times', () => {
    expect(isClockTime('08:00')).toBe(true);
    expect(isClockTime('23:59')).toBe(true);
    expect(isClockTime('24:00')).toBe(false);
    expect(isClockTime('8:00')).toBe(false);
    expect(isClockTime('')).toBe(false);
  });

  it('parseTimeList splits comma-separated times, unique-fies and sorts', () => {
    expect(parseTimeList('18:00, 08:00, 12:00, 08:00')).toEqual(['08:00', '12:00', '18:00']);
  });

  it('parseTimeList rejects the whole list when any token is malformed', () => {
    expect(parseTimeList('08:00, nope')).toEqual([]);
    expect(parseTimeList('nope')).toEqual([]);
  });
});

describe('normalizeTimesInput', () => {
  it('joins the parsed list with commas', () => {
    expect(normalizeTimesInput('18:00, 08:00')).toBe('08:00, 18:00');
    expect(normalizeTimesInput('junk')).toBe('');
  });
});

describe('splitStrength / formatStrength', () => {
  it('splits value + known unit', () => {
    expect(splitStrength('2.5 mg')).toEqual({ strength: '2.5', unit: 'mg' });
    expect(splitStrength('500')).toEqual({ strength: '500', unit: '' });
    // Unit must be whitespace-separated to split; "2.5mg" stays the raw value.
    expect(splitStrength('2.5mg')).toEqual({ strength: '2.5mg', unit: '' });
  });

  it('formatStrength appends the unit to bare numbers only', () => {
    expect(formatStrength('2.5', 'mg')).toBe('2.5 mg');
    expect(formatStrength('2.5', '')).toBe('2.5');
    expect(formatStrength('1000 IU', 'mg')).toBe('1000 IU');
  });
});

describe('parseDosageQuantity / splitDosage', () => {
  it('parses decimal quantities; zero and non-numbers are invalid', () => {
    expect(parseDosageQuantity('2')).toBe(2);
    expect(parseDosageQuantity('1,5')).toBe(1.5);
    expect(parseDosageQuantity('0')).toBeUndefined();
    expect(parseDosageQuantity('-2')).toBeUndefined();
    expect(parseDosageQuantity('abc')).toBeUndefined();
  });

  it('splitDosage separates quantity and unit', () => {
    expect(splitDosage('2 tablets')).toEqual({ dosageQuantity: '2', dosageUnit: 'tablets' });
    expect(splitDosage('2')).toEqual({ dosageQuantity: '2', dosageUnit: '' });
  });
});

describe('normalizeDateInput / parseSupply', () => {
  it('accepts zero-padded ISO dates and rejects impossible ones', () => {
    expect(normalizeDateInput('2026-01-05')).toBe('2026-01-05T12:00:00.000Z');
    expect(normalizeDateInput('2026-02-30')).toBeNull();
    expect(normalizeDateInput('2026-1-5')).toBeNull();
    expect(normalizeDateInput('not-a-date')).toBeNull();
  });

  it('parseSupply requires a positive integer prefix', () => {
    expect(parseSupply('30')).toBe(30);
    expect(parseSupply('0')).toBeUndefined();
    expect(parseSupply('-3')).toBeUndefined();
  });
});

describe('resolveDayOfWeek', () => {
  it('maps cadence to day sets', () => {
    expect(resolveDayOfWeek('daily', [])).toEqual([...WEEKDAY_FULL]);
    expect(resolveDayOfWeek('weekdays', [])).toEqual([...WEEKDAY_MON_FRI]);
    expect(resolveDayOfWeek('custom', ['sun', 'mon'])).toEqual(['sun', 'mon']);
  });
});

describe('scheduleFieldsFromForm', () => {
  it('clears times and sets asNeeded for as-needed cadence', () => {
    const fields = scheduleFieldsFromForm({
      ...EMPTY_FORM,
      cadence: 'as-needed',
      times: ['08:00'],
      maxPerDay: '3',
    });
    expect(fields.asNeeded).toBe(true);
    expect(fields.times).toEqual([]);
    expect(fields.maxPerDay).toBe(3);
    expect(fields.dayOfWeek).toEqual([...WEEKDAY_FULL]);
  });

  it('anchors interval plans to the regimen start when no anchor given', () => {
    const fields = scheduleFieldsFromForm({
      ...EMPTY_FORM,
      cadence: 'interval',
      intervalDays: '3',
      intervalStart: '',
      startDate: '2026-01-01',
    });
    expect(fields.intervalDays).toBe(3);
    expect(fields.intervalStart).toBe('2026-01-01');
  });

  it('drops dosage fields when the quantity is invalid', () => {
    const fields = scheduleFieldsFromForm({ ...EMPTY_FORM, dosageQuantity: '0' });
    expect(fields.dosageQuantity).toBeUndefined();
    expect(fields.dosageUnit).toBeUndefined();
  });
});

describe('validateMedicationForm', () => {
  const t = (key: string) => key;

  it('requires a name and a valid time list for scheduled plans', () => {
    const errors = validateMedicationForm({ ...EMPTY_FORM, name: '', times: [] }, t);
    expect(errors.name).toBe('addMedicationNameError');
    expect(errors.times).toBe('invalidTimesError');
  });

  it('excuses as-needed plans from times but validates maxPerDay', () => {
    const ok = validateMedicationForm({ ...EMPTY_FORM, cadence: 'as-needed', times: [] }, t);
    expect(ok.times).toBeUndefined();
    const bad = validateMedicationForm(
      { ...EMPTY_FORM, cadence: 'as-needed', times: [], maxPerDay: 'x' },
      t,
    );
    expect(bad.maxPerDay).toBe('maxPerDayError');
  });

  it('rejects a regimen start after its end', () => {
    const errors = validateMedicationForm(
      { ...EMPTY_FORM, startDate: '2026-03-01', endDate: '2026-02-01' },
      t,
    );
    expect(errors.startDate).toBe('startDateAfterEndDateError');
  });

  it('rejects custom cadence with no days selected', () => {
    const errors = validateMedicationForm({ ...EMPTY_FORM, cadence: 'custom', days: [] }, t);
    expect(errors.days).toBe('selectAtLeastOneDayError');
  });
});

const EMPTY_FORM: MedicationFormValues = {
  name: 'Test',
  form: 'Tablet',
  strength: '10',
  unit: 'mg',
  dosageQuantity: '',
  dosageUnit: 'tablets',
  times: ['08:00'],
  cadence: 'daily',
  days: [],
  supply: '',
  status: 'active',
  lastRefilled: '',
  startDate: '',
  intervalDays: '',
  intervalStart: '',
  endDate: '',
  maxPerDay: '',
  instruction: '',
  instructionNote: '',
  shape: 'round',
  color: '#F1ECE2',
};
