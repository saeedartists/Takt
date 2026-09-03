import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { addDays, atClockTime, dayCodeFromDate, isoDateKey, startOfDay } from './time';
import { useLocale } from './l10n';
import type { MedicationPlan } from './types';

const STORAGE_KEY = 'takt:scheduled-notification-ids:v1';
const CHANNEL_ID = 'takt-dose-reminders';
const MAX_PENDING_NOTIFICATIONS = 60;
const REMINDER_PERMISSION_STATE_KEY = 'takt:reminder-permission-state:v1';
const REMINDER_DIAGNOSTICS_KEY = 'takt:reminder-diagnostics:v1';
const REMINDER_SNOOZE_GUARD_KEY = 'takt:reminder-snooze-guard:v1';
const REBOOT_DETECTION_KEY = 'takt:last-launch-timestamp:v1';
const REMINDER_METRICS_KEY = 'takt:reminder-metrics:v1';

type ReminderPermissionState = {
  askedAt?: string;
  granted: boolean;
  source: 'consent' | 'system-check';
};

export type ReminderDiagnosticEvent = {
  id: string;
  at: string;
  kind:
    | 'permissions.requested'
    | 'permissions.granted'
    | 'permissions.denied'
    | 'schedule.reconcile.start'
    | 'schedule.reconcile.done'
    | 'schedule.reconcile.blocked'
    | 'schedule.reconcile.warning'
    | 'schedule.resumed'
    | 'schedule.timezone-changed'
    | 'schedule.cancelled'
    | 'schedule.reboot-detected'
    | 'schedule.resumed-after-reboot'
    | 'schedule.boot-received'
    | 'notification.received'
    | 'notification.opened'
    | 'snooze.scheduled'
    | 'snooze.skipped-single-limit';
  detail?: string;
};

export type ReminderMetrics = {
  totalScheduled: number;
  totalDelivered: number;
  totalMissed: number;
  lastUpdated: string;
};

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
  doseKey: string;
  requestRef: string;
};

type ReminderNotificationData = {
  route: '/(tabs)/today';
  doseKey: string;
  requestRef: string;
  scheduledAt: string;
};

const formatTemplate = (template: string, vars: Record<string, string>): string =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), template);

const buildDoseKey = (requestId: string, triggerAt: Date): string =>
  `${requestId}|${isoDateKey(triggerAt)}|${triggerAt.getHours().toString().padStart(2, '0')}:${triggerAt.getMinutes().toString().padStart(2, '0')}`;

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
        const requestId = plan.request.id;
        rows.push({
          triggerAt,
          title: copy.title,
          body: formatTemplate(copy.body, {
            label: plan.label,
            suffix,
            time,
          }),
          requestRef: `MedicationRequest/${requestId}`,
          doseKey: buildDoseKey(requestId, triggerAt),
        });
      }
    }
  }

  return rows
    .sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime())
    .slice(0, MAX_PENDING_NOTIFICATIONS);
};

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = async <T>(key: string, value: T): Promise<void> => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

const appendDiagnosticEvent = async (
  kind: ReminderDiagnosticEvent['kind'],
  detail?: string,
): Promise<void> => {
  const current = await readJson<ReminderDiagnosticEvent[]>(REMINDER_DIAGNOSTICS_KEY, []);
  const next: ReminderDiagnosticEvent[] = [
    {
      id: `${Date.now().toString()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      kind,
      detail,
    },
    ...current,
  ].slice(0, 200);
  await writeJson(REMINDER_DIAGNOSTICS_KEY, next);
};

export const readReminderDiagnostics = async (): Promise<ReminderDiagnosticEvent[]> =>
  readJson<ReminderDiagnosticEvent[]>(REMINDER_DIAGNOSTICS_KEY, []);

const readMetrics = async (): Promise<ReminderMetrics> =>
  readJson<ReminderMetrics>(REMINDER_METRICS_KEY, {
    totalScheduled: 0,
    totalDelivered: 0,
    totalMissed: 0,
    lastUpdated: new Date().toISOString(),
  });

const writeMetrics = async (metrics: ReminderMetrics): Promise<void> => {
  await writeJson(REMINDER_METRICS_KEY, metrics);
};

export const readReminderMetrics = readMetrics;

export const trackReminderScheduled = async (): Promise<void> => {
  const metrics = await readMetrics();
  metrics.totalScheduled += 1;
  metrics.lastUpdated = new Date().toISOString();
  await writeMetrics(metrics);
};

export const trackReminderDelivered = async (): Promise<void> => {
  const metrics = await readMetrics();
  metrics.totalDelivered += 1;
  metrics.lastUpdated = new Date().toISOString();
  await writeMetrics(metrics);
};

export const trackReminderMissed = async (): Promise<void> => {
  const metrics = await readMetrics();
  metrics.totalMissed += 1;
  metrics.lastUpdated = new Date().toISOString();
  await writeMetrics(metrics);
};

export const getDeliveryReliability = async (): Promise<number> => {
  const metrics = await readMetrics();
  if (metrics.totalScheduled === 0) return 100;
  return Math.round((metrics.totalDelivered / metrics.totalScheduled) * 100);
};

const checkForReboot = async (): Promise<boolean> => {
  const lastLaunch = await readJson<number | null>(REBOOT_DETECTION_KEY, null);
  const now = Date.now();

  await writeJson(REBOOT_DETECTION_KEY, now);

  if (!lastLaunch) return false;
  const gap = now - lastLaunch;
  const rebootThreshold = 24 * 60 * 60 * 1000;
  if (gap > rebootThreshold) {
    await appendDiagnosticEvent('schedule.reboot-detected', `gap:${gap.toString()}`);
    return true;
  }

  return false;
};

export const requestReminderPermissionsAtConsent = async (): Promise<boolean> => {
  await appendDiagnosticEvent('permissions.requested', 'consent-screen');

  const existing = await Notifications.getPermissionsAsync();
  const alreadyGranted =
    existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (alreadyGranted) {
    await writeJson<ReminderPermissionState>(REMINDER_PERMISSION_STATE_KEY, {
      askedAt: new Date().toISOString(),
      granted: true,
      source: 'system-check',
    });
    await appendDiagnosticEvent('permissions.granted', 'already-granted');
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  const granted =
    requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  await writeJson<ReminderPermissionState>(REMINDER_PERMISSION_STATE_KEY, {
    askedAt: new Date().toISOString(),
    granted,
    source: 'consent',
  });

  await appendDiagnosticEvent(granted ? 'permissions.granted' : 'permissions.denied');
  return granted;
};

const canScheduleWithoutPrompt = async (): Promise<boolean> => {
  const status = await Notifications.getPermissionsAsync();
  if (status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    await writeJson<ReminderPermissionState>(REMINDER_PERMISSION_STATE_KEY, {
      askedAt: new Date().toISOString(),
      granted: true,
      source: 'system-check',
    });
    return true;
  }

  const remembered = await readJson<ReminderPermissionState | null>(REMINDER_PERMISSION_STATE_KEY, null);
  if (remembered && remembered.granted === false) {
    await appendDiagnosticEvent('schedule.reconcile.blocked', 'permission-denied-remembered');
    return false;
  }

  await appendDiagnosticEvent('schedule.reconcile.blocked', 'permission-missing-no-consent-prompt');
  return false;
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

const getScheduleExactAlarmPermission = (): string | null => {
  const candidate = (PermissionsAndroid.PERMISSIONS as Record<string, string | undefined>)
    .SCHEDULE_EXACT_ALARM;
  return candidate ?? null;
};

const checkExactAlarmPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  if (typeof Platform.Version !== 'number' || Platform.Version < 31) return true;

  const exactAlarmPermission = getScheduleExactAlarmPermission();
  if (!exactAlarmPermission) {
    await appendDiagnosticEvent('schedule.reconcile.warning', 'exact-alarm-permission-unavailable');
    return false;
  }

  const hasPermission = await PermissionsAndroid.check(exactAlarmPermission as any);
  if (hasPermission) return true;

  try {
    const result = await PermissionsAndroid.request(exactAlarmPermission as any, {
      title: 'Exact Alarm Permission',
      message:
        'Takt needs exact alarm permission to remind you to take your medication at the right time.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });

    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

const openExactAlarmSettings = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  await Linking.openSettings();
};

export const useExactAlarmPermission = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<boolean> => {
    const result = await checkExactAlarmPermission();
    setHasPermission(result);
    setLoading(false);
    return result;
  }, []);

  useEffect(() => {
    let active = true;
    void checkExactAlarmPermission().then((result) => {
      if (!active) return;
      setHasPermission(result);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  return {
    hasPermission,
    loading,
    requestPermission: refresh,
    openSettings: openExactAlarmSettings,
  };
};

const readScheduledIds = async (): Promise<string[]> => readJson<string[]>(STORAGE_KEY, []);

const writeScheduledIds = async (ids: string[]): Promise<void> => {
  await writeJson(STORAGE_KEY, ids);
};

const reconcileSchedule = async (
  plans: MedicationPlan[],
  copy: { title: string; body: string },
): Promise<void> => {
  await appendDiagnosticEvent('schedule.reconcile.start', `plans:${plans.length.toString()}`);

  const canSchedule = await canScheduleWithoutPrompt();
  if (!canSchedule) {
    await writeScheduledIds([]);
    await appendDiagnosticEvent('schedule.reconcile.blocked', 'permission-denied');
    return;
  }

  const hasExactAlarm = await checkExactAlarmPermission();
  if (!hasExactAlarm) {
    await appendDiagnosticEvent('schedule.reconcile.blocked', 'exact-alarm-denied');
    await appendDiagnosticEvent('schedule.reconcile.warning', 'using-inexact-alarms');
  }

  await ensureChannel();
  const previousIds = await readScheduledIds();
  await Promise.all(previousIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  await appendDiagnosticEvent('schedule.cancelled', `count:${previousIds.length.toString()}`);

  const seeds = buildReminderSeeds(plans, copy);
  const nextIds: string[] = [];

  for (const seed of seeds) {
    const data: ReminderNotificationData = {
      route: '/(tabs)/today',
      doseKey: seed.doseKey,
      requestRef: seed.requestRef,
      scheduledAt: seed.triggerAt.toISOString(),
    };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: seed.title,
        body: seed.body,
        sound: 'default',
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: seed.triggerAt,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });

    nextIds.push(id);
    await trackReminderScheduled();
  }

  await writeScheduledIds(nextIds);
  await appendDiagnosticEvent('schedule.reconcile.done', `scheduled:${nextIds.length.toString()}`);
};

const readSnoozeGuards = async (): Promise<Record<string, string>> =>
  readJson<Record<string, string>>(REMINDER_SNOOZE_GUARD_KEY, {});

const writeSnoozeGuards = async (value: Record<string, string>): Promise<void> => {
  await writeJson(REMINDER_SNOOZE_GUARD_KEY, value);
};

const cleanupSnoozeGuards = (map: Record<string, string>): Record<string, string> => {
  const floor = Date.now() - 48 * 60 * 60 * 1000;
  return Object.fromEntries(
    Object.entries(map).filter(([, at]) => {
      const timestamp = new Date(at).getTime();
      return Number.isFinite(timestamp) && timestamp >= floor;
    }),
  );
};

export const scheduleSnoozeReminder = async (
  input: { label: string; delayMinutes?: number; doseKey: string },
  copy?: { title: string; body: string },
): Promise<{ scheduled: boolean }> => {
  await ensureChannel();

  const guards = cleanupSnoozeGuards(await readSnoozeGuards());
  if (guards[input.doseKey]) {
    await appendDiagnosticEvent('snooze.skipped-single-limit', input.doseKey);
    await writeSnoozeGuards(guards);
    return { scheduled: false };
  }

  const delayMinutes = input.delayMinutes ?? 15;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: copy?.title ?? 'Dose snoozed',
      body: copy?.body
        ? formatTemplate(copy.body, { label: input.label, minutes: delayMinutes.toString() })
        : `${input.label} reminder in ${delayMinutes.toString()} minutes`,
      sound: 'default',
      data: {
        route: '/(tabs)/today',
        doseKey: input.doseKey,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delayMinutes * 60,
      repeats: false,
      channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
    },
  });

  guards[input.doseKey] = new Date().toISOString();
  await writeSnoozeGuards(guards);
  await appendDiagnosticEvent('snooze.scheduled', `${input.doseKey}|${delayMinutes.toString()}`);
  await trackReminderScheduled();

  return { scheduled: true };
};

export const handleBootComplete = async (): Promise<void> => {
  await appendDiagnosticEvent('schedule.boot-received');
};

export const useReminderSync = (plans: MedicationPlan[], enabled: boolean): void => {
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

  const timezoneRef = useRef(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const sync = useCallback(async () => {
    if (!enabled) return;

    const wasRebooted = await checkForReboot();
    if (wasRebooted) {
      await appendDiagnosticEvent('schedule.resumed-after-reboot');
    }

    await reconcileSchedule(plans, {
      title: t('reminderNotificationTitle'),
      body: t('reminderNotificationBody'),
    });
  }, [enabled, plans, t]);

  useEffect(() => {
    void sync();
  }, [sync, signature]);

  useEffect(() => {
    if (!enabled) return;

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone !== timezoneRef.current) {
        timezoneRef.current = timezone;
        void appendDiagnosticEvent('schedule.timezone-changed', timezone);
      } else {
        void appendDiagnosticEvent('schedule.resumed');
      }

      void sync();
    });

    return () => {
      sub.remove();
    };
  }, [enabled, sync]);
};

const parseReminderNavigation = (
  response: Notifications.NotificationResponse | Notifications.Notification,
): {
  route: '/(tabs)/today';
  doseKey?: string;
  requestRef?: string;
} | null => {
  const data =
    'notification' in response
      ? (response.notification.request.content.data as Record<string, unknown> | undefined)
      : (response.request.content.data as Record<string, unknown> | undefined);

  if (!data) return null;
  if (data.route !== '/(tabs)/today') return null;

  return {
    route: '/(tabs)/today',
    doseKey: typeof data.doseKey === 'string' ? data.doseKey : undefined,
    requestRef: typeof data.requestRef === 'string' ? data.requestRef : undefined,
  };
};

type ReminderRouter = {
  push: (href: any) => void;
  replace: (href: any) => void;
};

export const useReminderResponseRouting = (router: ReminderRouter): void => {
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const target = parseReminderNavigation(notification);
      if (!target) return;
      void appendDiagnosticEvent('notification.received', target.doseKey ?? target.requestRef);
      void trackReminderDelivered();
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = parseReminderNavigation(response);
      if (!target) return;

      void appendDiagnosticEvent('notification.opened', target.doseKey ?? target.requestRef);
      const query = target.doseKey ? `?focus=${encodeURIComponent(target.doseKey)}` : '';
      router.push(`/(tabs)/today${query}` as never);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        const target = parseReminderNavigation(response);
        if (!target) return;

        void appendDiagnosticEvent('notification.opened', target.doseKey ?? target.requestRef);
        const query = target.doseKey ? `?focus=${encodeURIComponent(target.doseKey)}` : '';
        router.replace(`/(tabs)/today${query}` as never);
      });
    }, [router]),
  );
};

export const useReminderDiagnostics = (limit = 20) => {
  const [rows, setRows] = useState<ReminderDiagnosticEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void readReminderDiagnostics().then((result) => {
      if (!active) return;
      setRows(result.slice(0, limit));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [limit]);

  return {
    rows,
    loading,
    refetch: async () => {
      setLoading(true);
      const result = await readReminderDiagnostics();
      setRows(result.slice(0, limit));
      setLoading(false);
    },
  };
};

export const reminderDoseKey = buildDoseKey;
