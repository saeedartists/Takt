import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  PageShell,
  SectionHeader,
  Stack,
  spacing,
  typography,
} from '@/components/ui';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useEnsurePatient, useRecordConsent } from '@/lib/hooks/use-takt-mutations';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { requestReminderPermissions } from '@/lib/takt/reminders';
import { useTokens } from '@/theme/use-tokens';

export default function ConsentScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { c } = useTokens();
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
      await requestReminderPermissions();
      await AsyncStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
      router.replace('/(tabs)/today');
    } catch {
      setSubmitError(t('consentSaveError'));
    }
  };

  const busy = consent.isPending || ensurePatient.isPending || patient.isLoading;

  return (
    <PageShell>
      <PageHeader title={t('consentTitle')} subtitle={t('legal')} />
      <Stack>
        <View>
          <SectionHeader title={t('consentTitle')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <Badge label={t('legal')} tone="accent" />
              <Text style={[typography.body, { color: c.textPrimary }]}>{t('consentBody')}</Text>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('consentPermissionsHint')}</Text>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('safetyNote')}</Text>
              {submitError ? <Text style={[typography.footnote, { color: c.destructive }]}>{submitError}</Text> : null}
            </View>
          </Card>
        </View>
        <Button label={t('acceptConsent')} onPress={() => void submit()} disabled={busy} />
      </Stack>
    </PageShell>
  );
}
