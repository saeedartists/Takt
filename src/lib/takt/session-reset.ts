import AsyncStorage from '@react-native-async-storage/async-storage';
import { ovokFetch } from '@/lib/ovok-fetch';
import { queryClient } from '@/lib/query-client';
import { CONSENT_STORAGE_KEY } from './constants';
import { cancelAllReminders } from './reminders';
import type { ConsentResource, FhirBundle } from './types';

const LAST_PROFILE_KEY = 'takt:last-profile:v1';

/**
 * Device-level keys that survive a sign-out. Everything else under `takt:` is
 * treated as the signed-in user's data and wiped (deny by default, so a new
 * user-scoped key can't leak to the next person on the device).
 */
const DEVICE_KEYS = new Set([
  LAST_PROFILE_KEY,
  'takt:locale',
  'takt:theme-mode:v1',
  'takt:theme-palette:v1',
  'takt:text-scale:v1',
  'takt:tour-seen:v1',
  'takt:reminder-preferences:v1',
  'takt:reminder-permission-state:v1',
  'takt:exact-alarm-prompted-at:v1',
  'takt:last-launch-timestamp:v1',
  'takt:reminder-diagnostics:v1',
  'takt:reminder-metrics:v1',
  // QA / release tooling state, not patient data.
  'takt:accessibility-pass:v1',
  'takt:isolation-matrix:v1',
  'takt:readiness:checklist:v1',
  'takt:reminder-certification:v1',
  'takt:session-token-matrix:v1',
  'takt:report-review:v1',
  // Mock-mode demo stores.
  'takt:local-store:v2',
  'takt:mock-store:v1',
]);

export const isUserScopedKey = (key: string): boolean =>
  key.startsWith('takt:') && !DEVICE_KEYS.has(key);

/** Wipes the signed-in user's local footprint: reminders, query cache, user-scoped storage. */
export const clearUserLocalState = async (): Promise<void> => {
  await cancelAllReminders();
  queryClient.clear();
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter(isUserScopedKey));
};

/**
 * Call right after a successful sign-in / registration. A different account
 * than last time gets a clean device; then the consent flag is restored from
 * the server so a returning user isn't asked again.
 */
export const beginUserSession = async (profileRef: string): Promise<void> => {
  const last = await AsyncStorage.getItem(LAST_PROFILE_KEY);
  if (last !== profileRef) await clearUserLocalState();
  await AsyncStorage.setItem(LAST_PROFILE_KEY, profileRef);

  if (!profileRef.startsWith('Patient/')) return;
  try {
    const bundle = await ovokFetch<FhirBundle<ConsentResource>>(
      `/fhir/R4/Consent?patient=${encodeURIComponent(profileRef)}&_sort=-date&_count=1`,
    );
    const latest = bundle.entry?.[0]?.resource;
    if (latest?.status === 'active') await AsyncStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
  } catch {
    // Offline or server error: the consent screen asks again, which is safe.
  }
};
