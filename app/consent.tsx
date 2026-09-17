import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  PageShell,
  Stack,
  radius,
  spacing,
  typography,
  useMotion,
} from '@/components/ui';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useEnsurePatient, useRecordConsent } from '@/lib/hooks/use-takt-mutations';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { requestReminderPermissionsAtConsent } from '@/lib/takt/reminders';
import { useTokens } from '@/theme/use-tokens';

export default function ConsentScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { c } = useTokens();
  const { enter } = useMotion();
  const patient = usePrimaryPatient();
  const ensurePatient = useEnsurePatient();
  const consent = useRecordConsent();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitError(null);

    try {
      const existing = patient.data;
      const patientRef = existing
        ? `Patient/${existing.id}`
        : `Patient/${(await ensurePatient.mutateAsync()).id}`;

      await consent.mutateAsync(patientRef);
      await requestReminderPermissionsAtConsent();
      await AsyncStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
      router.replace('/(tabs)/today');
    } catch {
      setSubmitError(t('consentSaveError'));
    }
  };

  const busy = consent.isPending || ensurePatient.isPending || patient.isLoading;

  const trustPoints = [
    {
      icon: 'lock-closed-outline' as const,
      title: t('consentPillarStandardTitle'),
      description: t('consentPillarStandardDescription'),
    },
    {
      icon: 'notifications-outline' as const,
      title: t('consentPillarRemindersTitle'),
      description: t('consentPillarRemindersDescription'),
    },
    {
      icon: 'document-text-outline' as const,
      title: t('consentPillarReportTitle'),
      description: t('consentPillarReportDescription'),
    },
  ];

  return (
    <PageShell>
      <PageHeader title={t('consentTitle')} subtitle={t('legal')} />
      <Stack>
        {/* Shield Hero */}
        <Card>
          <View style={{ padding: spacing(5), alignItems: 'center', gap: spacing(3) }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: radius.xl,
                backgroundColor: `${c.accent}1A`,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: `${c.accent}33`,
              }}
            >
              <Ionicons name="shield-checkmark" size={36} color={c.accent} />
            </View>

            <View style={{ alignItems: 'center', gap: spacing(1) }}>
              <Badge label={t('legal')} tone="accent" />
              <Text style={[typography.title2, { color: c.textPrimary, textAlign: 'center' }]}>
                {t('consentTitle')}
              </Text>
              <Text
                style={[
                  typography.subhead,
                  { color: c.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 4 },
                ]}
              >
                {t('consentBody')}
              </Text>
            </View>
          </View>
        </Card>

        {/* 3 Pillars of Trust */}
        <View style={{ gap: spacing(3) }}>
          {trustPoints.map((point, index) => (
            <Animated.View key={point.icon} entering={enter(index)}>
              <Card>
              <View style={{ padding: spacing(4), flexDirection: 'row', gap: spacing(3.5), alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: `${c.accent}14`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  <Ionicons name={point.icon} size={20} color={c.accent} />
                </View>

                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[typography.headline, { color: c.textPrimary }]}>{point.title}</Text>
                  <Text style={[typography.footnote, { color: c.textSecondary, lineHeight: 18 }]}>
                    {point.description}
                  </Text>
                </View>
              </View>
              </Card>
            </Animated.View>
          ))}
        </View>

        {/* Safety Note + permission disclosure */}
        <Card>
          <View style={{ padding: spacing(4), flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start' }}>
            <Ionicons name="information-circle-outline" size={20} color={c.textSecondary} />
            <View style={{ flex: 1, gap: spacing(1.5) }}>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('safetyNote')}</Text>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('consentPermissionsHint')}</Text>
            </View>
          </View>
        </Card>

        {submitError ? (
          <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive, textAlign: 'center' }]}>
            {submitError}
          </Text>
        ) : null}

        <Button label={t('acceptConsent')} onPress={() => void submit()} loading={busy} />
      </Stack>
    </PageShell>
  );
}
