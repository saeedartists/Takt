import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, ListGroup, ListRow, PageShell, SectionHeader, SkeletonCard, Stack, spacing, typography, useTokens } from '@/components/ui';
import { ConfirmExpander } from '@/components/takt/confirm-expander';
import { useConsentStatus } from '@/lib/hooks/use-consent-status';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useWithdrawConsent } from '@/lib/hooks/use-takt-mutations';
import { CONSENT_STORAGE_KEY, TAKT_CONSENT_VERSION } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';

/** What was agreed, when, under which version, and the one place to withdraw it. */
export default function ConsentSettingsScreen() {
  const { c } = useTokens();
  const { t, formatDate } = useLocale();
  const router = useRouter();
  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const consent = useConsentStatus(patientRef);
  const withdrawConsent = useWithdrawConsent();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = async () => {
    setError(null);
    try {
      if (patientRef) await withdrawConsent.mutateAsync(patientRef);
      await AsyncStorage.removeItem(CONSENT_STORAGE_KEY);
      router.replace('/consent');
    } catch {
      setError(t('withdrawConsentError'));
    }
  };

  const givenOn = consent.currentAt
    ? formatDate(new Date(consent.currentAt), { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <PageShell>
      <Stack>
        {patient.isLoading || consent.isLoading ? (
          <SkeletonCard rows={2} />
        ) : (
          <Card>
            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <View style={[styles.icon, { backgroundColor: `${c.accent}1A` }]}>
                  <Ionicons name="shield-checkmark" size={24} color={c.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[typography.headline, { color: c.textPrimary }]}>{t('consentTitle')}</Text>
                  {givenOn ? (
                    <Text style={[typography.subhead, { color: c.textSecondary }]}>
                      {t('consentGivenOn').replace('{date}', givenOn)}
                    </Text>
                  ) : null}
                </View>
                <Badge
                  label={consent.isActive ? t('consentStatusActive') : t('consentStatusInactive')}
                  tone={consent.isActive ? 'success' : 'neutral'}
                />
              </View>
              <Text style={[typography.body, { color: c.textSecondary }]}>{t('consentBody')}</Text>
              <Text style={[typography.footnote, { color: c.textTertiary }]}>
                {t('consentVersionLabel').replace('{version}', TAKT_CONSENT_VERSION)}
              </Text>
            </View>
          </Card>
        )}

        <ListGroup>
          <ListRow
            isFirst
            title={t('privacyNotice')}
            leading={<Ionicons name="document-text-outline" size={20} color={c.textSecondary} />}
            onPress={() => router.push('/settings/privacy')}
          />
        </ListGroup>

        <View>
          <SectionHeader title={t('withdrawConsent')} />
          <Card>
            <View style={styles.cardBody}>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('withdrawConsentHint')}</Text>
              <ConfirmExpander
                open={confirm}
                onOpen={() => setConfirm(true)}
                onCancel={() => setConfirm(false)}
                onConfirm={() => void withdraw()}
                triggerLabel={t('withdrawConsent')}
                triggerKind="destructive"
                confirmLabel={t('withdrawCta')}
                body={t('withdrawConsentConfirmBody')}
                loading={withdrawConsent.isPending}
                disabled={patient.isLoading}
              />
              {error ? (
                <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>
                  {error}
                </Text>
              ) : null}
            </View>
          </Card>
        </View>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  cardBody: { padding: spacing(4), gap: spacing(3) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
