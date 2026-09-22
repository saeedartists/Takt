import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useRecordDose, useUpdateMedicationPlan } from '@/lib/hooks/use-takt-mutations';
import { useLocale } from '@/lib/takt/l10n';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { scheduleSnoozeReminder, useReminderResponseRouting, useReminderSync } from '@/lib/takt/reminders';
import { buildDoseOccurrencesForDay } from '@/lib/takt/schedule';
import { startOfDay } from '@/lib/takt/time';
import { resolveSessionGate } from '@/lib/auth-session';
import { CONTENT_MAX_WIDTH, radius, spacing, typography } from '@/theme/tokens';
import { useTokens } from '@/theme/use-tokens';

export default function TabsLayout() {
  const { t } = useLocale();
  const router = useRouter();
  const { c } = useTokens();
  const insets = useSafeAreaInsets();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const prefs = useReminderPreferences();
  const recordDose = useRecordDose();
  const updatePlan = useUpdateMedicationPlan();

  useReminderSync(plans.plans, Boolean(patientRef) && !plans.isLoading);

  // Lock-screen actions: confirm or snooze straight from the reminder.
  useReminderResponseRouting(router, {
    onTaken: (target) => {
      if (!patientRef || !target.requestRef || !target.scheduledAt) return;
      recordDose.mutate({
        patientRef,
        medicationRef: target.medicationRef,
        requestRef: target.requestRef,
        scheduledAt: new Date(target.scheduledAt),
        action: 'taken',
      });
    },
    onSnooze: (target) => {
      if (!target.doseKey) return;
      void scheduleSnoozeReminder(
        { label: target.label ?? '', delayMinutes: prefs.data?.snoozeMinutes, doseKey: target.doseKey },
        { title: t('doseSnoozedTitle'), body: t('doseSnoozedBody'), bodyPrivate: t('doseSnoozedBodyPrivate') },
      );
    },
  });

  const events = useDoseEvents(patientRef);
  const dueNowCount = useMemo(() => {
    const now = new Date();
    return buildDoseOccurrencesForDay(
      plans.plans,
      (events.data?.entry ?? []).map((x) => x.resource),
      startOfDay(now),
      now,
      prefs.data?.graceHours,
    ).filter((dose) => dose.state === 'due').length;
  }, [events.data?.entry, plans.plans, prefs.data?.graceHours]);

  // A pause with an end date resumes by itself: flip the plan back to active once the date has passed.
  const resumed = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!patientRef) return;
    const now = Date.now();
    for (const plan of plans.plans) {
      if (plan.request.status !== 'on-hold' || !plan.medication) continue;
      const last = plan.pauseHistory[plan.pauseHistory.length - 1];
      if (!last?.end || new Date(last.end).getTime() > now || resumed.current.has(plan.request.id)) continue;
      resumed.current.add(plan.request.id);
      updatePlan.mutate({
        patientRef,
        name: plan.label,
        form: plan.form,
        strength: plan.strength,
        cadence: plan.cadence,
        dayOfWeek: plan.dayOfWeek,
        times: plan.times,
        supplyCount: plan.supplyCount,
        status: 'active',
        request: plan.request,
        medication: plan.medication,
      });
    }
  }, [patientRef, plans.plans, updatePlan]);

  useEffect(() => {
    let active = true;

    const guard = async () => {
      const gate = await resolveSessionGate();
      if (!active) return;

      if (gate.kind === 'needs-config' || gate.kind === 'backend-unreachable') {
        router.replace('/setup' as never);
        return;
      }

      if (gate.kind === 'unauthenticated') {
        router.replace('/auth/sign-in' as never);
      }
    };

    void guard();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.separator,
          borderTopWidth: 0.5,
          // React Navigation pads the bar by the bottom inset; a fixed height would squeeze icons on iPhones with a home indicator.
          height: 64 + insets.bottom,
          paddingTop: spacing(1),
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          // Match the content reading column on wide web viewports.
          ...(Platform.OS === 'web'
            ? { width: '100%' as const, maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' as const }
            : null),
        },
        tabBarLabelStyle: {
          fontSize: typography.caption.fontSize,
          lineHeight: typography.caption.lineHeight,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t('today'),
          tabBarBadge: dueNowCount > 0 ? dueNowCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: c.accent,
            color: c.surface,
            fontSize: typography.caption2.fontSize,
            lineHeight: typography.caption2.lineHeight,
            fontWeight: '700',
          },
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: t('medications'),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'medkit' : 'medkit-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('history'),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
