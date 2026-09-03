import type { WeekdayCode } from './types';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
  return unique.sort((a, b) => {
    const [ah, am] = a.split(':').map((x) => Number.parseInt(x, 10));
    const [bh, bm] = b.split(':').map((x) => Number.parseInt(x, 10));
    return ah * 60 + am - (bh * 60 + bm);
  });
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
