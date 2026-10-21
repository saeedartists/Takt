import { DateTime } from 'luxon';
import type { WeekdayCode } from './types.js';

export const WEEKDAY_ORDER: WeekdayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAYS_ONLY: WeekdayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

const WEEKDAY_SET = new Set<WeekdayCode>(WEEKDAY_ORDER);

const pad = (value: number): string => value.toString().padStart(2, '0');

export const zoneOrUtc = (zone?: string): string => (zone && zone.trim() ? zone.trim() : 'UTC');

export const parseInstant = (value: string, zone: string): DateTime | null => {
  const parsed = DateTime.fromISO(value, { zone });
  return parsed.isValid ? parsed : null;
};

export const parseDateOnly = (value: string | undefined, zone: string): DateTime | null => {
  if (!value) return null;
  const parsed = DateTime.fromISO(value, { zone });
  if (!parsed.isValid) return null;
  if (parsed.toFormat('yyyy-MM-dd') !== value.slice(0, 10)) return null;
  return parsed.startOf('day');
};

export const startOfDay = (value: Date | DateTime, zone: string): DateTime => {
  const dt = value instanceof Date ? DateTime.fromJSDate(value, { zone }) : value.setZone(zone);
  return dt.startOf('day');
};

export const addDays = (value: DateTime, days: number): DateTime => value.plus({ days });

export const atClockTime = (day: DateTime, timeOfDay: string, zone: string): DateTime => {
  const [hours = '0', minutes = '0'] = timeOfDay.split(':');
  return day.setZone(zone).set({
    hour: Number.parseInt(hours, 10),
    minute: Number.parseInt(minutes, 10),
    second: 0,
    millisecond: 0,
  });
};

export const dayCodeFromDate = (value: DateTime, zone: string): WeekdayCode => {
  const weekday = value.setZone(zone).weekday;
  if (weekday === 1) return 'mon';
  if (weekday === 2) return 'tue';
  if (weekday === 3) return 'wed';
  if (weekday === 4) return 'thu';
  if (weekday === 5) return 'fri';
  if (weekday === 6) return 'sat';
  return 'sun';
};

export const isoDateKey = (value: DateTime, zone: string): string => value.setZone(zone).toFormat('yyyy-MM-dd');

export const localScheduledKey = (value: DateTime, zone: string): string => {
  const local = value.setZone(zone);
  return `${local.toFormat('yyyy-MM-dd')}|${pad(local.hour)}:${pad(local.minute)}`;
};

export const toIsoInstant = (value: DateTime): string => value.toUTC().toISO() ?? value.toISO() ?? '';

export const fromTimeOfDay = (raw: string): string => toTimeOfDay(raw).slice(0, 5);

export const toTimeOfDay = (raw: string): string => {
  const [rawHours, rawMinutes] = raw.split(':');
  const hours = Number.parseInt(rawHours ?? '', 10);
  const minutes = Number.parseInt(rawMinutes ?? '', 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '08:00:00';
  return `${pad(Math.max(0, Math.min(23, hours)))}:${pad(Math.max(0, Math.min(59, minutes)))}:00`;
};

export const sortTimes = (times: string[]): string[] =>
  [...times].sort((a, b) => {
    const [aHours = 0, aMinutes = 0] = a.split(':').map((value) => Number.parseInt(value, 10));
    const [bHours = 0, bMinutes = 0] = b.split(':').map((value) => Number.parseInt(value, 10));
    return aHours * 60 + aMinutes - (bHours * 60 + bMinutes);
  });

export const normalizeWeekdayCodes = (days: string[]): WeekdayCode[] => {
  const filtered = days.filter((day): day is WeekdayCode => WEEKDAY_SET.has(day as WeekdayCode));
  const unique = new Set(filtered);
  return WEEKDAY_ORDER.filter((day) => unique.has(day));
};

export const hoursBetween = (from: DateTime, to: DateTime): number => to.diff(from, 'hours').hours;

export const isQuietHours = (now: DateTime, zone: string, startHour = 21, endHour = 8): boolean => {
  const hour = now.setZone(zone).hour;
  if (startHour === endHour) return false;
  if (startHour > endHour) return hour >= startHour || hour < endHour;
  return hour >= startHour && hour < endHour;
};
