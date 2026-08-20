'use client';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_SNOOZE_MINUTES, REMINDER_PREFS_STORAGE_KEY } from './constants';

export type ReminderPreferences = {
  snoozeMinutes: number;
};

const sanitizeSnoozeMinutes = (value: number): number => {
  const allowed = [5, 10, 15, 30];
  return allowed.includes(value) ? value : DEFAULT_SNOOZE_MINUTES;
};

const defaultPreferences = (): ReminderPreferences => ({
  snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
});

export const readReminderPreferences = async (): Promise<ReminderPreferences> => {
  const raw = await AsyncStorage.getItem(REMINDER_PREFS_STORAGE_KEY);
  if (!raw) return defaultPreferences();

  try {
    const parsed = JSON.parse(raw) as { snoozeMinutes?: unknown };
    const minutes =
      typeof parsed.snoozeMinutes === 'number'
        ? sanitizeSnoozeMinutes(parsed.snoozeMinutes)
        : DEFAULT_SNOOZE_MINUTES;
    return { snoozeMinutes: minutes };
  } catch {
    return defaultPreferences();
  }
};

export const writeReminderPreferences = async (prefs: ReminderPreferences): Promise<void> => {
  const next = { snoozeMinutes: sanitizeSnoozeMinutes(prefs.snoozeMinutes) };
  await AsyncStorage.setItem(REMINDER_PREFS_STORAGE_KEY, JSON.stringify(next));
};

export const useReminderPreferences = () => {
  const qc = useQueryClient();

  const query = useQuery<ReminderPreferences>({
    queryKey: ['takt', 'preferences', 'reminders'],
    queryFn: readReminderPreferences,
  });

  const mutation = useMutation({
    mutationFn: async (snoozeMinutes: number) => {
      const next = { snoozeMinutes: sanitizeSnoozeMinutes(snoozeMinutes) };
      await writeReminderPreferences(next);
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(['takt', 'preferences', 'reminders'], next);
    },
  });

  return {
    ...query,
    setSnoozeMinutes: mutation.mutateAsync,
    isSaving: mutation.isPending,
    saveError: mutation.error,
  };
};
