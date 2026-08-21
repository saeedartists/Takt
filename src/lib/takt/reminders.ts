import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { addDays, atClockTime, dayCodeFromDate, startOfDay } from './time';
import { useLocale } from './l10n';
import type { MedicationPlan } from './types';

const STORAGE_KEY = 'takt:scheduled-notification-ids:v1';
const CHANNEL_ID = 'takt-dose-reminders';
const MAX_PENDING_NOTIFICATIONS = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type ReminderSeed = {
  triggerAt: Date;
  title: string;
  body: string;
};

const formatTemplate = (template: string, vars: Record<string, string>): string =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), template);

const canScheduleOnDay = (plan: MedicationPlan, date: Date): boolean => {
  if (plan.request.status !== 'active') return false;
  return plan.dayOfWeek.includes(dayCodeFromDate(date));
};

const buildReminderSeeds = (
  plans: MedicationPlan[],
  copy: { title: string; body: string },
  horizonDays = 21,
): ReminderSeed[] => {
  const now = new Date();
  const floor = new Date(now.getTime() + 60_000);
  const days = Array.from({ length: horizonDays }, (_, i) => addDays(startOfDay(now), i));

  const rows: ReminderSeed[] = [];
  for (const day of days) {
    for (const plan of plans) {
      if (!canScheduleOnDay(plan, day)) continue;
      for (const time of plan.times) {
        const triggerAt = atClockTime(day, time);
        if (triggerAt <= floor) continue;
        const suffix = plan.strength ? ` (${plan.strength})` : '';
        rows.push({
          triggerAt,
          title: copy.title,
          body: formatTemplate(copy.body, {
            label: plan.label,
            suffix,
            time,
          }),
        });
      }
    }
  }

  return rows
    .sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime())
    .slice(0, MAX_PENDING_NOTIFICATIONS);
};

export const requestReminderPermissions = async (): Promise<boolean> => {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
};

const ensureChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Dose reminders',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
};

const readScheduledIds = async (): Promise<string[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const writeScheduledIds = async (ids: string[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
};

const replaceSchedule = async (
  plans: MedicationPlan[],
  copy: { title: string; body: string },
): Promise<void> => {
  await ensureChannel();
  const previousIds = await readScheduledIds();
  await Promise.all(previousIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));

  const seeds = buildReminderSeeds(plans, copy);
  const nextIds: string[] = [];

  for (const seed of seeds) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: seed.title,
        body: seed.body,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: seed.triggerAt,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
    nextIds.push(id);
  }

  await writeScheduledIds(nextIds);
};

export const scheduleSnoozeReminder = async (
  label: string,
  delayMinutes = 15,
  copy?: { title: string; body: string },
): Promise<void> => {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: copy?.title ?? 'Dose snoozed',
      body:
        copy?.body
          ? formatTemplate(copy.body, { label, minutes: delayMinutes.toString() })
          : `${label} reminder in ${delayMinutes.toString()} minutes`,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delayMinutes * 60,
      repeats: false,
      channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
    },
  });
};

export const useReminderSync = (
  plans: MedicationPlan[],
  enabled: boolean,
): void => {
  const { t } = useLocale();
  const signature = useMemo(
    () =>
      JSON.stringify(
        plans
          .map((plan) => ({
            id: plan.request.id,
            status: plan.request.status,
            cadence: plan.cadence,
            days: [...plan.dayOfWeek],
            times: [...plan.times].sort(),
            label: plan.label,
            strength: plan.strength,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      ),
    [plans],
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    void (async () => {
      const granted = await requestReminderPermissions();
      if (!granted || cancelled) return;
      await replaceSchedule(plans, {
        title: t('reminderNotificationTitle'),
        body: t('reminderNotificationBody'),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, signature]);
};
