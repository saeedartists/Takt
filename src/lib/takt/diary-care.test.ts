import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => h.store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      h.store.set(key, value);
    },
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({}),
  useQueryClient: () => ({}),
  useMutation: () => ({}),
}));

import { readDiary, summarizeDiary, type DiaryMap } from './diary';
import { appointmentDate, daysUntil, splitAppointments } from './care';

describe('diary summary', () => {
  it('summarizes exactly the last N calendar days including today', () => {
    const map: DiaryMap = {
      '2026-01-14': { date: '2026-01-14', mood: 5, symptoms: ['headache'], updatedAt: 'x' },
      '2026-01-21': { date: '2026-01-21', mood: 1, symptoms: [], updatedAt: 'x' },
    };
    const summary = summarizeDiary(map, 7, new Date(2026, 0, 21, 12));
    expect(summary.days).toHaveLength(7);
    expect(summary.days[0].date).toBe('2026-01-15');
    expect(summary.days[6].date).toBe('2026-01-21');
    expect(summary.logged).toBe(1);
    expect(summary.average).toBe(1);
  });

  it('counts every logged day of a symptom, not per symptom occurrence', () => {
    const map: DiaryMap = {
      '2026-01-20': { date: '2026-01-20', mood: 3, symptoms: ['dizzy', 'tired'], updatedAt: 'x' },
      '2026-01-21': { date: '2026-01-21', mood: 2, symptoms: ['dizzy'], updatedAt: 'x' },
    };
    const summary = summarizeDiary(map, 7, new Date(2026, 0, 21, 12));
    expect(summary.topSymptoms[0]).toEqual({ code: 'dizzy', days: 2 });
    expect(summary.average).toBe(2.5);
  });

  it('returns a null average with no entries', () => {
    expect(summarizeDiary({}, 7, new Date(2026, 0, 21, 12))).toMatchObject({ logged: 0, average: null, topSymptoms: [] });
  });
});

describe('diary persistence sanitation', () => {
  it('drops malformed entries, clamps notes and dedupes unknown symptoms', async () => {
    h.store.set(
      'takt:diary:v1',
      JSON.stringify({
        good: { date: '2026-01-20', mood: 4, symptoms: ['dizzy', 'bogus'], note: `x${'y'.repeat(600)}`, updatedAt: 'x' },
        bad: { date: 'not-a-date', mood: 3, symptoms: [] },
        weird: { date: '2026-01-19', mood: 9, symptoms: [] },
      }),
    );
    const map = await readDiary();
    // Entries with an out-of-range mood are dropped whole (never repaired to a fake value).
    expect(Object.keys(map).sort()).toEqual(['2026-01-20']);
    expect(map['2026-01-20'].symptoms).toEqual(['dizzy']);
    expect(map['2026-01-20'].note).toHaveLength(500);
  });
});

describe('care appointments', () => {
  it('counts whole calendar days down to the appointment day', () => {
    const now = new Date(2026, 0, 21, 17, 30);
    expect(daysUntil({ id: '1', title: 'a', date: '2026-01-21' }, now)).toBe(0);
    expect(daysUntil({ id: '1', title: 'a', date: '2026-01-22' }, now)).toBe(1);
    expect(daysUntil({ id: '1', title: 'a', date: '2026-01-14' }, now)).toBe(-7);
  });

  it('keeps the day boundary stable across a DST shift', () => {
    // Oct 25 2026 is the European DST-off change; the day count must not drift.
    const now = new Date(2026, 9, 24, 18);
    expect(daysUntil({ id: '1', title: 'a', date: '2026-10-25' }, now)).toBe(1);
    expect(daysUntil({ id: '1', title: 'a', date: '2026-11-01' }, now)).toBe(8);
  });

  it('splits upcoming (today or later, soonest first) and past (newest first)', () => {
    const now = new Date(2026, 0, 21, 12);
    const list = [
      { id: 'a', title: 'a', date: '2026-01-15' },
      { id: 'b', title: 'b', date: '2026-01-22', time: '09:00' },
      { id: 'c', title: 'c', date: '2026-01-21', time: '08:00' },
      { id: 'd', title: 'd', date: '2026-01-21', time: '16:30' },
      { id: 'e', title: 'e', date: '2026-01-23' },
    ];
    const { upcoming, past } = splitAppointments(list, now);
    expect(upcoming.map((a) => a.id)).toEqual(['c', 'd', 'b', 'e']);
    expect(past.map((a) => a.id)).toEqual(['a']);
  });

  it('dates an untimed appointment at local noon so day maths never crosses midnight', () => {
    const at = appointmentDate({ id: '1', title: 'a', date: '2026-01-21' });
    expect(at.getHours()).toBe(12);
  });
});
