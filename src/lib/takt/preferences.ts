'use client';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_SNOOZE_MINUTES, REMINDER_PREFS_STORAGE_KEY } from './constants';

export type ReminderPreferences = {
  snoozeMinutes: number;
  /** Play the default notification sound; false schedules silent reminders. */
  sound: boolean;
};

const QUERY_KEY = ['takt', 'preferences', 'reminders'] as const;

const sanitizeSnoozeMinutes = (value: number): number => {
  const allowed = [5, 10, 15, 30];
  return allowed.includes(value) ? value : DEFAULT_SNOOZE_MINUTES;
};

const sanitize = (input: Partial<ReminderPreferences> | undefined): ReminderPreferences => ({
  snoozeMinutes:
    typeof input?.snoozeMinutes === 'number' ? sanitizeSnoozeMinutes(input.snoozeMinutes) : DEFAULT_SNOOZE_MINUTES,
  sound: typeof input?.sound === 'boolean' ? input.sound : true,
});

export const readReminderPreferences = async (): Promise<ReminderPreferences> => {
  const raw = await AsyncStorage.getItem(REMINDER_PREFS_STORAGE_KEY);
  if (!raw) return sanitize(undefined);

  try {
    return sanitize(JSON.parse(raw) as Partial<ReminderPreferences>);
  } catch {
    return sanitize(undefined);
  }
};

export const writeReminderPreferences = async (prefs: Partial<ReminderPreferences>): Promise<ReminderPreferences> => {
  const next = sanitize({ ...(await readReminderPreferences()), ...prefs });
  await AsyncStorage.setItem(REMINDER_PREFS_STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const useReminderPreferences = () => {
  const qc = useQueryClient();

  const query = useQuery<ReminderPreferences>({
    queryKey: QUERY_KEY,
    queryFn: readReminderPreferences,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<ReminderPreferences>) => writeReminderPreferences(patch),
    onSuccess: (next) => {
      qc.setQueryData(QUERY_KEY, next);
    },
  });

  return {
    ...query,
    setSnoozeMinutes: (snoozeMinutes: number) => mutation.mutateAsync({ snoozeMinutes }),
    setSound: (sound: boolean) => mutation.mutateAsync({ sound }),
    isSaving: mutation.isPending,
    saveError: mutation.error,
  };
};
