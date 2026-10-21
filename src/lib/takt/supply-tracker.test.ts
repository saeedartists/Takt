import AsyncStorage from '@react-native-async-storage/async-storage';
import { describe, expect, it, vi } from 'vitest';

import { LOW_SUPPLY_THRESHOLD, deductSupply, getSupplyCount, restoreSupply, setSupplyCount } from './supply-tracker';

const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => h.store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      h.store.set(key, value);
    },
  },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

vi.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 5 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  IosAuthorizationStatus: { PROVISIONAL: 2 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval', WEEKLY: 'weekly' },
  getPermissionsAsync: async () => ({ granted: true, status: 'granted', ios: { status: 2 } }),
  scheduleNotificationAsync: async () => 'nudge-id',
  cancelScheduledNotificationAsync: async () => undefined,
  setNotificationChannelAsync: async () => undefined,
  deleteNotificationChannelAsync: async () => undefined,
}));

vi.mock('./preferences', () => ({
  readReminderPreferences: async () => ({ sound: false, hideNamesInReminders: false }),
  useReminderPreferences: () => ({ data: undefined }),
}));

describe('supply tracker', () => {
  it('defaults to one unit per dose', async () => {
    await setSupplyCount('med-1', 20);
    expect(await deductSupply('med-1', 'Ramipril')).toBe(19);
    expect(await getSupplyCount('med-1')).toBe(19);
  });

  it('deducts the per-intake quantity', async () => {
    await setSupplyCount('med-2', 20);
    expect(await deductSupply('med-2', 'Ramipril', 3)).toBe(17);
    expect(await getSupplyCount('med-2')).toBe(17);
  });

  it('never goes below zero and floors quantity at one', async () => {
    await setSupplyCount('med-3', 2);
    expect(await deductSupply('med-3', undefined, 5)).toBe(0);
    expect(await deductSupply('med-3', undefined, 0)).toBe(0);
  });

  it('is a no-op when no count was ever set', async () => {
    expect(await deductSupply('med-none', 'x')).toBeNull();
    expect(await restoreSupply('med-none')).toBeNull();
  });

  it('restoring from zero clears the has-run-out state', async () => {
    await setSupplyCount('med-4', 1);
    await deductSupply('med-4');
    expect(await getSupplyCount('med-4')).toBe(0);

    const rawBefore = await AsyncStorage.getItem('takt:supply-tracker:v1');
    expect(JSON.parse(rawBefore ?? '{}')['med-4'].outNudgedAt).toBeTruthy();

    expect(await restoreSupply('med-4')).toBe(1);
    const row = JSON.parse((await AsyncStorage.getItem('takt:supply-tracker:v1')) ?? '{}')['med-4'];
    expect(row.outNudgedAt).toBeUndefined();
    expect(row.count).toBe(1);
  });

  it('restoring above the low-supply thresholds resets the once-only nudge flags', async () => {
    await setSupplyCount('med-5', 5);
    await deductSupply('med-5');
    expect(await getSupplyCount('med-5')).toBe(4);

    const dipped = JSON.parse((await AsyncStorage.getItem('takt:supply-tracker:v1')) ?? '{}')['med-5'];
    expect(dipped.lowSupplyNudgedAt).toBeTruthy();
    expect(dipped.nudgeId).toBe('nudge-id');
    expect(LOW_SUPPLY_THRESHOLD).toBe(7);

    expect(await restoreSupply('med-5', 30)).toBe(34);
    const row = JSON.parse((await AsyncStorage.getItem('takt:supply-tracker:v1')) ?? '{}')['med-5'];
    expect(row.lowSupplyNudgedAt).toBeUndefined();
    expect(row.nudgeId).toBeUndefined();
  });
});
