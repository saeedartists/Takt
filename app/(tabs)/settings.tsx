import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  ListGroup,
  ListRow,
  PageHeader,
  PageShell,
  SectionHeader,
  SegmentedControl,
  Stack,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { ovokClient } from '@/lib/ovok-client';
import { useWithdrawConsent } from '@/lib/hooks/use-takt-mutations';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { env } from '@/lib/env';

const SNOOZE_OPTIONS = [5, 10, 15, 30] as const;

export default function SettingsTabScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { locale, setLocale, t } = useLocale();
  const patient = usePrimaryPatient();
  const withdrawConsent = useWithdrawConsent();
  const reminderPrefs = useReminderPreferences();
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const patientRef = patient.data ? `Patient/${patient.data.id}` : null;

  const withdraw = async () => {
    setWithdrawError(null);

    try {
      if (patientRef) {
        await withdrawConsent.mutateAsync(patientRef);
      }
      await AsyncStorage.removeItem(CONSENT_STORAGE_KEY);
      router.replace('/consent');
    } catch {
      setWithdrawError(t('withdrawConsentError'));
    }
  };

  const signOut = () => {
    ovokClient.clearActiveLogin();
    router.replace('/auth/sign-in' as never);
  };

  return (
    <PageShell>
      <PageHeader title={t('settings')} />

      <Stack>
        <View>
          <SectionHeader title={t('language')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <SegmentedControl
                value={locale}
                onChange={(next) => void setLocale(next as 'de' | 'en')}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'de', label: 'Deutsch' },
                ]}
              />
              <Badge label={locale === 'de' ? t('languageActiveDe') : t('languageActiveEn')} tone="accent" />
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title={t('reminders')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('snoozeAfter')}</Text>
              <SegmentedControl
                value={(reminderPrefs.data?.snoozeMinutes ?? 15).toString()}
                onChange={(next) => void reminderPrefs.setSnoozeMinutes(Number.parseInt(next, 10))}
                options={SNOOZE_OPTIONS.map((minutes) => ({
                  value: minutes.toString(),
                  label: `${minutes.toString()}m`,
                }))}
              />
              <Badge
                label={t('snoozeActive').replace('{minutes}', (reminderPrefs.data?.snoozeMinutes ?? 15).toString())}
                tone="neutral"
              />
            </View>
          </Card>
          {reminderPrefs.saveError ? <ErrorState description={t('saveReminderPrefError')} /> : null}
        </View>

        <View>
          <SectionHeader title={t('legal')} />
          <ListGroup>
            <ListRow isFirst title={t('privacyNotice')} onPress={() => router.push('/settings/privacy')} />
            <ListRow title={t('imprint')} onPress={() => router.push('/settings/imprint')} />
            <ListRow title={t('readinessTitle')} onPress={() => router.push('/settings/readiness')} />
            <ListRow title={t('isolationTitle')} onPress={() => router.push('/settings/isolation')} />
          </ListGroup>
        </View>

        {env.ovokMockEnabled ? null : (
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('accountSectionTitle')}</Text>
              <Button label={t('signOut')} kind="secondary" onPress={signOut} />
            </View>
          </Card>
        )}

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('safetyNote')}</Text>
            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('aboutTakt')}</Text>
            <Button
              label={t('withdrawConsent')}
              kind="destructive"
              onPress={() => void withdraw()}
              disabled={withdrawConsent.isPending || patient.isLoading}
            />
            {withdrawError ? <Text style={[typography.footnote, { color: c.destructive }]}>{withdrawError}</Text> : null}
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
