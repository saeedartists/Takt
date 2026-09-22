import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
};

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
    title: 'Low supply reminder',
    body: 'Supply dropped to 7 or fewer. Refill this medication soon.',
  },
  de: {
    title: 'Erinnerung: Vorrat fast aufgebraucht',
    body: 'Der Vorrat liegt bei 7 oder weniger. Bitte bald nachfüllen.',
  },
} as const;

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

const scheduleLowSupplyReminder = async (): Promise<void> => {
  const permissions = await Notifications.getPermissionsAsync();
  const granted =
    permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted) {
    return;
  }

  await ensureSupplyChannel();

  const locale = await getLocale();
  const copy = reminderCopy[locale];

  await Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      sound: 'default',
      data: {
        route: '/(tabs)/medications',
        kind: 'low-supply',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      repeats: false,
      channelId: Platform.OS === 'android' ? SUPPLY_CHANNEL_ID : undefined,
    },
  });
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
  };
  await writeStore(store);
};

export const clearSupplyCount = async (medicationId: string): Promise<void> => {
  const store = await readStore();
  if (!(medicationId in store)) return;
  delete store[medicationId];
  await writeStore(store);
};

export const deductSupply = async (medicationId: string): Promise<number | null> => {
  const store = await readStore();
  const row = store[medicationId];
  if (!hasCount(row)) return null;

  const previousCount = toInt(row.count);
  const nextCount = Math.max(0, previousCount - 1);

  const shouldNudge = previousCount > LOW_SUPPLY_THRESHOLD && nextCount <= LOW_SUPPLY_THRESHOLD && nextCount > 0;

  store[medicationId] = {
    ...row,
    count: nextCount,
    lowSupplyNudgedAt: shouldNudge ? new Date().toISOString() : row.lowSupplyNudgedAt,
  };

  await writeStore(store);

  if (shouldNudge) {
    await scheduleLowSupplyReminder();
  }

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
