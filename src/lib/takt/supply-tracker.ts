import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const SUPPLY_STORAGE_KEY = 'takt:supply-tracker:v1';
const LOCALE_STORAGE_KEY = 'takt:locale';
const LOW_SUPPLY_THRESHOLD = 7;
const SUPPLY_CHANNEL_ID = 'takt-supply-alerts';

type SupplyLocale = 'en' | 'de';

type SupplyState = {
  count: number;
  dailyRate?: number;
  lastRefilledAt?: string;
  lowSupplyNudgedAt?: string;
};

type SupplyStore = Record<string, SupplyState>;

const toInt = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
};

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

  await Notifications.setNotificationChannelAsync(SUPPLY_CHANNEL_ID, {
    name: 'Supply alerts',
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

export const getSupplyCount = async (medicationId: string): Promise<number | null> => {
  const store = await readStore();
  const row = store[medicationId];
  if (!row) return null;
  return toInt(row.count);
};

export const setSupplyCount = async (medicationId: string, count: number): Promise<void> => {
  const store = await readStore();
  const nextCount = toInt(count);
  const previous = store[medicationId];

  const next: SupplyState = {
    ...(previous ?? { count: nextCount }),
    count: nextCount,
    lastRefilledAt:
      previous?.lastRefilledAt ?? (nextCount > 0 ? new Date().toISOString() : undefined),
    lowSupplyNudgedAt: nextCount > LOW_SUPPLY_THRESHOLD ? undefined : previous?.lowSupplyNudgedAt,
  };

  if (previous && nextCount > toInt(previous.count)) {
    next.lastRefilledAt = new Date().toISOString();
    next.lowSupplyNudgedAt = undefined;
  }

  store[medicationId] = next;
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
  if (!row) return null;

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
  const store = await readStore();
  const row = store[medicationId];
  if (!row) return null;

  const count = toInt(row.count);
  if (count <= 0) return 0;

  const rate = row.dailyRate && Number.isFinite(row.dailyRate) && row.dailyRate > 0 ? row.dailyRate : 1;
  return Math.ceil(count / rate);
};

export const setDailyConsumptionRate = async (medicationId: string, rate: number): Promise<void> => {
  const store = await readStore();
  const current = store[medicationId] ?? { count: 0 };
  const nextRate = Number.isFinite(rate) && rate > 0 ? rate : 1;

  store[medicationId] = {
    ...current,
    dailyRate: nextRate,
  };

  await writeStore(store);
};

export const getLastRefilledAt = async (medicationId: string): Promise<string | null> => {
  const store = await readStore();
  return store[medicationId]?.lastRefilledAt ?? null;
};

export const setLastRefilledAt = async (medicationId: string, isoDate: string | null): Promise<void> => {
  const store = await readStore();
  const current = store[medicationId] ?? { count: 0 };

  store[medicationId] = {
    ...current,
    lastRefilledAt: isoDate ?? undefined,
  };

  await writeStore(store);
};
