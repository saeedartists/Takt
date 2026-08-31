import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';
import { useReminderResponseRouting, useReminderSync } from '@/lib/takt/reminders';
import { resolveSessionGate } from '@/lib/auth-session';
import { radius, spacing } from '@/theme/tokens';
import { useTokens } from '@/theme/use-tokens';

export default function TabsLayout() {
  const { t } = useLocale();
  const router = useRouter();
  const { c } = useTokens();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);

  useReminderSync(plans.plans, Boolean(patientRef) && !plans.isLoading);
  useReminderResponseRouting(router);


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
          height: 70,
          paddingTop: spacing(1),
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t('today'),
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
