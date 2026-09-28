'use client';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { addDays, isoDateKey, startOfDay } from './time';

/*
 * Health diary — one patient-reported check-in per day (mood + symptoms +
 * an optional note). On-device only, like the reminder preferences: it is
 * never written to the FHIR record.
 */

export const DIARY_STORAGE_KEY = 'takt:diary:v1';

export type Mood = 1 | 2 | 3 | 4 | 5;
export const MOODS: Mood[] = [1, 2, 3, 4, 5];

export const SYMPTOM_CODES = [
  'dizzy',
  'nausea',
  'headache',
  'tired',
  'pain',
  'poor-sleep',
  'low-appetite',
  'other',
] as const;
export type SymptomCode = (typeof SYMPTOM_CODES)[number];

export type DiaryEntry = {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  mood: Mood;
  symptoms: SymptomCode[];
  note?: string;
  updatedAt: string;
};

export type DiaryMap = Record<string, DiaryEntry>;

const QUERY_KEY = ['takt', 'diary'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_MAX = 500;

const sanitizeEntry = (raw: unknown): DiaryEntry | null => {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Partial<DiaryEntry>;
  if (typeof e.date !== 'string' || !DATE_RE.test(e.date)) return null;
  if (!MOODS.includes(e.mood as Mood)) return null;
  const symptoms = Array.isArray(e.symptoms)
    ? SYMPTOM_CODES.filter((code) => (e.symptoms as unknown[]).includes(code))
    : [];
  const note = typeof e.note === 'string' && e.note.trim() ? e.note.trim().slice(0, NOTE_MAX) : undefined;
  return {
    date: e.date,
    mood: e.mood as Mood,
    symptoms,
    note,
    updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : new Date(0).toISOString(),
  };
};

export const readDiary = async (): Promise<DiaryMap> => {
  const raw = await AsyncStorage.getItem(DIARY_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: DiaryMap = {};
    for (const value of Object.values(parsed ?? {})) {
      const entry = sanitizeEntry(value);
      if (entry) out[entry.date] = entry;
    }
    return out;
  } catch {
    return {};
  }
};

export const todayKey = (): string => isoDateKey(new Date());

/** Parse a YYYY-MM-DD key as a local date (not UTC). */
export const dateFromKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Newest first. */
export const sortedEntries = (map: DiaryMap): DiaryEntry[] =>
  Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1));

export type DiarySummary = {
  /** One slot per day, oldest first; null where nothing was noted. */
  days: { date: string; mood: Mood | null }[];
  logged: number;
  /** Mean mood over logged days, one decimal; null when nothing logged. */
  average: number | null;
  /** Symptom → number of days it was noted, most frequent first. */
  topSymptoms: { code: SymptomCode; days: number }[];
};

/** Summarise the last `days` calendar days up to and including `end`. */
export const summarizeDiary = (map: DiaryMap, days: number, end: Date = new Date()): DiarySummary => {
  const last = startOfDay(end);
  const slots = Array.from({ length: days }, (_, i) => {
    const date = isoDateKey(addDays(last, i - days + 1));
    return { date, mood: map[date]?.mood ?? null };
  });
  const counts = new Map<SymptomCode, number>();
  let sum = 0;
  let logged = 0;
  for (const slot of slots) {
    const entry = map[slot.date];
    if (!entry) continue;
    logged += 1;
    sum += entry.mood;
    for (const code of entry.symptoms) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const topSymptoms = [...counts.entries()]
    .map(([code, n]) => ({ code, days: n }))
    .sort((a, b) => b.days - a.days || SYMPTOM_CODES.indexOf(a.code) - SYMPTOM_CODES.indexOf(b.code));
  return { days: slots, logged, average: logged ? Math.round((sum / logged) * 10) / 10 : null, topSymptoms };
};

export const useDiary = () => {
  const qc = useQueryClient();
  const query = useQuery<DiaryMap>({ queryKey: QUERY_KEY, queryFn: readDiary });

  /*
   * Optimistic: the cache updates synchronously so a tap feels instant,
   * then the whole map is persisted. ponytail: one JSON blob, fine for
   * years of daily entries (~100 bytes each).
   */
  const persist = async (next: DiaryMap) => {
    qc.setQueryData(QUERY_KEY, next);
    await AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(next));
  };

  const current = async () => qc.getQueryData<DiaryMap>(QUERY_KEY) ?? (await readDiary());

  const save = async (date: string, patch: Partial<Omit<DiaryEntry, 'date' | 'updatedAt'>>) => {
    const map = await current();
    const entry = sanitizeEntry({ ...(map[date] ?? { symptoms: [] }), ...patch, date, updatedAt: new Date().toISOString() });
    if (!entry) return;
    await persist({ ...map, [date]: entry });
  };

  const remove = async (date: string) => {
    const { [date]: _gone, ...rest } = await current();
    await persist(rest);
  };

  return { ...query, map: query.data ?? {}, save, remove };
};
