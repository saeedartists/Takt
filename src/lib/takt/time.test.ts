import { describe, expect, it } from 'vitest';

import {
  addDays,
  atClockTime,
  dayCodeFromDate,
  fromTimeOfDay,
  isWeekday,
  isoDateKey,
  normalizeWeekdayCodes,
  sortTimes,
  startOfDay,
  toTimeOfDay,
  WEEKDAY_ORDER,
} from './time';

describe('toTimeOfDay', () => {
  it('normalizes HH:MM to HH:MM:00', () => {
    expect(toTimeOfDay('8:05')).toBe('08:05:00');
    expect(toTimeOfDay('22:30')).toBe('22:30:00');
  });

  it('clamps out-of-range components', () => {
    expect(toTimeOfDay('25:70')).toBe('23:59:00');
    expect(toTimeOfDay('-3:15')).toBe('00:15:00');
  });

  it('falls back to 08:00:00 on malformed input', () => {
    expect(toTimeOfDay('abc')).toBe('08:00:00');
    expect(toTimeOfDay('')).toBe('08:00:00');
  });
});

describe('fromTimeOfDay', () => {
  it('pads short components', () => {
    expect(fromTimeOfDay('8:5')).toBe('08:05');
  });

  it('falls back to 08:00 without both parts', () => {
    expect(fromTimeOfDay('8')).toBe('08:00');
    expect(fromTimeOfDay('')).toBe('08:00');
  });
});

describe('atClockTime / startOfDay / addDays', () => {
  it('atClockTime keeps the day and swaps the clock', () => {
    const base = new Date(2026, 0, 15, 9, 45);
    const moved = atClockTime(base, '18:30');
    expect(isoDateKey(moved)).toBe('2026-01-15');
    expect(moved.getHours()).toBe(18);
    expect(moved.getMinutes()).toBe(30);
    expect(moved.getSeconds()).toBe(0);
    expect(moved.getMilliseconds()).toBe(0);
  });

  it('startOfDay zeroes the clock', () => {
    const start = startOfDay(new Date(2026, 4, 2, 13, 22, 9, 123));
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it('addDays crosses month boundaries exactly', () => {
    expect(isoDateKey(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
    expect(isoDateKey(addDays(new Date(2026, 1, 28), 1))).toBe('2026-03-01');
  });
});

describe('dayCodeFromDate / isWeekday', () => {
  it('maps 2026-01-01 (Thursday) to thu', () => {
    expect(dayCodeFromDate(new Date(2026, 0, 1))).toBe('thu');
  });

  it('maps Sunday correctly', () => {
    expect(dayCodeFromDate(new Date(2026, 0, 4))).toBe('sun');
  });

  it('isWeekday accepts mon–fri and rejects sat/sun', () => {
    expect(isWeekday(new Date(2026, 0, 5))).toBe(true); // Mon
    expect(isWeekday(new Date(2026, 0, 9))).toBe(true); // Fri
    expect(isWeekday(new Date(2026, 0, 10))).toBe(false); // Sat
    expect(isWeekday(new Date(2026, 0, 11))).toBe(false); // Sun
  });
});

describe('isoDateKey', () => {
  it('formats local midnight-safety dates without UTC drift', () => {
    expect(isoDateKey(new Date(2026, 10, 21))).toBe('2026-11-21');
  });
});

describe('sortTimes', () => {
  it('orders chronologically and does not mutate input', () => {
    const input = ['18:00', '08:00', '12:30'];
    const sorted = sortTimes(input);
    expect(sorted).toEqual(['08:00', '12:30', '18:00']);
    expect(input).toEqual(['18:00', '08:00', '12:30']);
  });
});

describe('normalizeWeekdayCodes', () => {
  it('drops invalid codes, unique-fies, and re-orders to WEEKDAY_ORDER', () => {
    expect(normalizeWeekdayCodes(['sun', 'bogus', 'mon', 'sun'])).toEqual(['mon', 'sun']);
  });

  it('returns an empty array for no valid codes', () => {
    expect(normalizeWeekdayCodes(['x', 'y'])).toEqual([]);
  });

  it('WEEKDAY_ORDER is mon→sun', () => {
    expect(WEEKDAY_ORDER[0]).toBe('mon');
    expect(WEEKDAY_ORDER[6]).toBe('sun');
  });
});
