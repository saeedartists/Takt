'use client';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_GRACE_HOURS, DEFAULT_SNOOZE_MINUTES, REMINDER_PREFS_STORAGE_KEY } from './constants';

export type GraceHours = 2 | 4 | 6;

export type ReminderPreferences = {
  snoozeMinutes: number;
  /** Play the default notification sound; false schedules silent reminders. */
  sound: boolean;
  /** Keep the medication name out of the lock screen ("Time for your 08:00 dose"). */
  hideNamesInReminders: boolean;
  /** Hours after the scheduled time before an unlogged dose counts as missed (brief §12: 4 by default). */
  graceHours: GraceHours;
};

const QUERY_KEY = ['takt', 'preferences', 'reminders'] as const;
export const GRACE_OPTIONS: GraceHours[] = [2, 4, 6];

const sanitizeSnoozeMinutes = (value: number): number => {
  const allowed = [5, 10, 15, 30];
  return allowed.includes(value) ? value : DEFAULT_SNOOZE_MINUTES;
};

const sanitize = (input: Partial<ReminderPreferences> | undefined): ReminderPreferences => ({
  snoozeMinutes:
    typeof input?.snoozeMinutes === 'number' ? sanitizeSnoozeMinutes(input.snoozeMinutes) : DEFAULT_SNOOZE_MINUTES,
  sound: typeof input?.sound === 'boolean' ? input.sound : true,
  hideNamesInReminders: input?.hideNamesInReminders === true,
  graceHours: GRACE_OPTIONS.includes(input?.graceHours as GraceHours)
    ? (input?.graceHours as GraceHours)
    : (DEFAULT_GRACE_HOURS as GraceHours),
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
    setHideNames: (hideNamesInReminders: boolean) => mutation.mutateAsync({ hideNamesInReminders }),
    setGraceHours: (graceHours: GraceHours) => mutation.mutateAsync({ graceHours }),
    isSaving: mutation.isPending,
    saveError: mutation.error,
  };
};
