import type { WeekdayCode } from './types';

const pad = (n: number): string => n.toString().padStart(2, '0');

export const WEEKDAY_ORDER: WeekdayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_SET = new Set<WeekdayCode>(WEEKDAY_ORDER);
export const WEEKDAYS_ONLY: WeekdayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const toTimeOfDay = (raw: string): string => {
  const [h, m] = raw.split(':').map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '08:00:00';
  return `${pad(Math.max(0, Math.min(23, h)))}:${pad(Math.max(0, Math.min(59, m)))}:00`;
};

export const fromTimeOfDay = (raw: string): string => {
  const [h, m] = raw.split(':');
  if (!h || !m) return '08:00';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
};

export const atClockTime = (base: Date, timeOfDay: string): Date => {
  const [h = '0', m = '0'] = timeOfDay.split(':');
  const d = new Date(base);
  d.setHours(Number.parseInt(h, 10), Number.parseInt(m, 10), 0, 0);
  return d;
};

export const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d: Date, days: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

export const dayCodeFromDate = (d: Date): WeekdayCode => {
  const day = d.getDay();
  if (day === 0) return 'sun';
  if (day === 1) return 'mon';
  if (day === 2) return 'tue';
  if (day === 3) return 'wed';
  if (day === 4) return 'thu';
  if (day === 5) return 'fri';
  return 'sat';
};

export const isWeekday = (d: Date): boolean => {
  const day = d.getDay();
  return day >= 1 && day <= 5;
};

export const isoDateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const formatClock = (d: Date): string =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatShortDate = (d: Date): string =>
  d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

export const sortTimes = (times: string[]): string[] =>
  [...times].sort((a, b) => {
    const [ah, am] = a.split(':').map((x) => Number.parseInt(x, 10));
    const [bh, bm] = b.split(':').map((x) => Number.parseInt(x, 10));
    return ah * 60 + am - (bh * 60 + bm);
  });

export const normalizeWeekdayCodes = (days: string[]): WeekdayCode[] => {
  const filtered = days.filter((d): d is WeekdayCode => WEEKDAY_SET.has(d as WeekdayCode));
  const unique = [...new Set(filtered)];
  return WEEKDAY_ORDER.filter((d) => unique.includes(d));
};
