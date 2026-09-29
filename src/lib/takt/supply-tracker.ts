import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { readReminderPreferences } from './preferences';

const SUPPLY_STORAGE_KEY = 'takt:supply-tracker:v1';
const LOCALE_STORAGE_KEY = 'takt:locale';
/** At or below this many units the app nudges for a refill (brief §11, v1.1). */
export const LOW_SUPPLY_THRESHOLD = 7;
const SUPPLY_CHANNEL_ID = 'takt-supply-alerts';

type SupplyLocale = 'en' | 'de';

type SupplyState = {
  /** Absent until the user enters a count: a rate or refill date alone must not read as "0 left". */
  count?: number;
  /** Count right after the last refill or manual set; the progress bar's 100%. */
  capacity?: number;
  dailyRate?: number;
  lastRefilledAt?: string;
  lowSupplyNudgedAt?: string;
  /** Scheduled refill-reminder notification, cancelled if a refill is logged before it fires. */
  nudgeId?: string;
  /** Set once the "has run out" reminder went out; cleared by a refill. */
  outNudgedAt?: string;
};

/** Refill reminders start when about this many days of supply are left. */
export const LOW_SUPPLY_DAYS = 7;

type SupplyStore = Record<string, SupplyState>;

export type SupplySnapshot = {
  count: number;
  capacity: number;
  daysUntilRefill: number;
  lastRefilledAt: string | null;
};

const hasCount = (row: SupplyState | undefined): row is SupplyState & { count: number } =>
  typeof row?.count === 'number';

const toInt = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
};

const rateOf = (row: SupplyState): number =>
  row.dailyRate && Number.isFinite(row.dailyRate) && row.dailyRate > 0 ? row.dailyRate : 1;

const readStore = async (): Promise<SupplyStore> => {
  const raw = await AsyncStorage.getItem(SUPPLY_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as SupplyStore;
  } catch {
    return {};
  }
};

const writeStore = async (value: SupplyStore): Promise<void> => {
  await AsyncStorage.setItem(SUPPLY_STORAGE_KEY, JSON.stringify(value));
};

const getLocale = async (): Promise<SupplyLocale> => {
  const raw = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
  return raw === 'de' ? 'de' : 'en';
};

const reminderCopy = {
  en: {
    title: 'Time to refill',
    low: (label: string, days: number) =>
      days <= 1 ? `${label} runs out in about a day.` : `${label} runs out in about ${days} days.`,
    lowPrivate: (days: number) =>
      days <= 1 ? 'A medication runs out in about a day.' : `A medication runs out in about ${days} days.`,
    out: (label: string) => `${label} has run out. Log a refill once you have a new pack.`,
    outPrivate: 'A medication has run out. Log a refill once you have a new pack.',
  },
  de: {
    title: 'Zeit zum Nachfüllen',
    low: (label: string, days: number) =>
      days <= 1 ? `${label} reicht noch etwa einen Tag.` : `${label} reicht noch etwa ${days} Tage.`,
    lowPrivate: (days: number) =>
      days <= 1 ? 'Ein Medikament reicht noch etwa einen Tag.' : `Ein Medikament reicht noch etwa ${days} Tage.`,
    out: (label: string) => `${label} ist aufgebraucht. Tragen Sie die Nachfüllung ein, sobald Sie eine neue Packung haben.`,
    outPrivate: 'Ein Medikament ist aufgebraucht. Tragen Sie die Nachfüllung ein, sobald Sie eine neue Packung haben.',
  },
} as const;

/** The next 10:00 local: a calm hour to think about the pharmacy, never mid-dose. */
const nextMorningAt10 = (from = new Date()): Date => {
  const at = new Date(from);
  at.setHours(10, 0, 0, 0);
  if (at.getTime() <= from.getTime() + 60_000) at.setDate(at.getDate() + 1);
  return at;
};

const ensureSupplyChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  const locale = await getLocale();
  await Notifications.setNotificationChannelAsync(SUPPLY_CHANNEL_ID, {
    name: locale === 'de' ? 'Vorratshinweise' : 'Supply alerts',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
};

/**
 * One refill reminder, named and dated ("Ramipril runs out in about 5 days"),
 * at the next 10:00. Returns the notification id so a refill can cancel it.
 */
const scheduleRefillReminder = async (input: { label?: string; days: number; out: boolean }): Promise<string | undefined> => {
  if (Platform.OS === 'web') return undefined;
  const permissions = await Notifications.getPermissionsAsync();
  const granted =
    permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) return undefined;

  await ensureSupplyChannel();
  const copy = reminderCopy[await getLocale()];
  const prefs = await readReminderPreferences();
  const named = Boolean(input.label) && !prefs.hideNamesInReminders;
  const label = input.label ?? '';
  const body = input.out
    ? named
      ? copy.out(label)
      : copy.outPrivate
    : named
      ? copy.low(label, input.days)
      : copy.lowPrivate(input.days);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body,
      sound: prefs.sound ? 'default' : false,
      data: { route: '/refills', kind: 'low-supply' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextMorningAt10(),
      channelId: Platform.OS === 'android' ? SUPPLY_CHANNEL_ID : undefined,
    },
  });
};

const cancelNudge = async (row: SupplyState | undefined): Promise<void> => {
  if (row?.nudgeId) await Notifications.cancelScheduledNotificationAsync(row.nudgeId).catch(() => undefined);
};

/** Everything a screen shows about supply, in one read. Null when no count was ever set. */
export const getSupplySnapshot = async (medicationId: string): Promise<SupplySnapshot | null> => {
  const store = await readStore();
  const row = store[medicationId];
  if (!hasCount(row)) return null;
  const count = toInt(row.count);
  return {
    count,
    capacity: Math.max(toInt(row.capacity ?? count), count, 1),
    daysUntilRefill: count <= 0 ? 0 : Math.ceil(count / rateOf(row)),
    lastRefilledAt: row.lastRefilledAt ?? null,
  };
};

export const getSupplyCount = async (medicationId: string): Promise<number | null> => {
  const store = await readStore();
  const row = store[medicationId];
  if (!hasCount(row)) return null;
  return toInt(row.count);
};

export const setSupplyCount = async (medicationId: string, count: number): Promise<void> => {
  const store = await readStore();
  const nextCount = toInt(count);
  const previous = store[medicationId];
  const refilled = hasCount(previous) && nextCount > toInt(previous.count);

  store[medicationId] = {
    ...(previous ?? {}),
    count: nextCount,
    capacity: refilled || !hasCount(previous) ? nextCount : Math.max(previous.capacity ?? 0, nextCount),
    lastRefilledAt: refilled
      ? new Date().toISOString()
      : (previous?.lastRefilledAt ?? (nextCount > 0 ? new Date().toISOString() : undefined)),
    lowSupplyNudgedAt: refilled || nextCount > LOW_SUPPLY_THRESHOLD ? undefined : previous?.lowSupplyNudgedAt,
    // A refill (or a higher count) makes any pending reminder moot.
    nudgeId: refilled || nextCount > LOW_SUPPLY_THRESHOLD ? undefined : previous?.nudgeId,
    outNudgedAt: nextCount > 0 ? undefined : previous?.outNudgedAt,
  };
  if (refilled || nextCount > LOW_SUPPLY_THRESHOLD) await cancelNudge(previous);
  await writeStore(store);
};

export const clearSupplyCount = async (medicationId: string): Promise<void> => {
  const store = await readStore();
  if (!(medicationId in store)) return;
  delete store[medicationId];
  await writeStore(store);
};

/**
 * One dose taken: count down, and nudge once when the supply first reaches
 * about a week left (by days at the current rate, or the unit threshold),
 * and once more if it runs out. `label` names the medicine in the reminder.
 */
export const deductSupply = async (medicationId: string, label?: string): Promise<number | null> => {
  const store = await readStore();
  const row = store[medicationId];
  if (!hasCount(row)) return null;

  const previousCount = toInt(row.count);
  const nextCount = Math.max(0, previousCount - 1);
  const nextDays = nextCount <= 0 ? 0 : Math.ceil(nextCount / rateOf(row));
  const isLow = nextCount <= LOW_SUPPLY_THRESHOLD || nextDays <= LOW_SUPPLY_DAYS;

  const nudgeLow = isLow && nextCount > 0 && !row.lowSupplyNudgedAt;
  const nudgeOut = nextCount === 0 && previousCount > 0 && !row.outNudgedAt;

  let nudgeId = row.nudgeId;
  if (nudgeLow || nudgeOut) {
    await cancelNudge(row);
    nudgeId = await scheduleRefillReminder({ label, days: nextDays, out: nudgeOut }).catch(() => undefined);
  }

  store[medicationId] = {
    ...row,
    count: nextCount,
    lowSupplyNudgedAt: nudgeLow ? new Date().toISOString() : row.lowSupplyNudgedAt,
    outNudgedAt: nudgeOut ? new Date().toISOString() : row.outNudgedAt,
    nudgeId,
  };
  await writeStore(store);
  return nextCount;
};

export const getDaysUntilRefill = async (medicationId: string): Promise<number | null> => {
  const snapshot = await getSupplySnapshot(medicationId);
  return snapshot ? snapshot.daysUntilRefill : null;
};

export const setDailyConsumptionRate = async (medicationId: string, rate: number): Promise<void> => {
  const store = await readStore();
  store[medicationId] = {
    ...(store[medicationId] ?? {}),
    dailyRate: Number.isFinite(rate) && rate > 0 ? rate : 1,
  };
  await writeStore(store);
};

export const getLastRefilledAt = async (medicationId: string): Promise<string | null> => {
  const store = await readStore();
  return store[medicationId]?.lastRefilledAt ?? null;
};

export const setLastRefilledAt = async (medicationId: string, isoDate: string | null): Promise<void> => {
  const store = await readStore();
  store[medicationId] = {
    ...(store[medicationId] ?? {}),
    lastRefilledAt: isoDate ?? undefined,
  };
  await writeStore(store);
};
