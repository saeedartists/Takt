import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  Badge,
  Card,
  INK,
  ListGroup,
  ListRow,
  PageShell,
  SectionHeader,
  SkeletonCard,
  Stack,
  Tile,
  TileIcon,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { ConfirmExpander } from '@/components/takt/confirm-expander';
import { useConsentStatus } from '@/lib/hooks/use-consent-status';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useWithdrawConsent } from '@/lib/hooks/use-takt-mutations';
import { CONSENT_STORAGE_KEY, TAKT_CONSENT_VERSION } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';

/** What was agreed, when, under which version, and the one place to withdraw it. */
export default function ConsentSettingsScreen() {
  const { c } = useTokens();
  const { enter } = useMotion();
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
          <Animated.View entering={enter(0)}>
            <Tile tone={consent.isActive ? 'sage' : 'surface'} style={styles.hero}>
              <View style={styles.titleRow}>
                <TileIcon name={consent.isActive ? 'shield-checkmark' : 'shield-outline'} size={48} color={consent.isActive ? INK : c.textPrimary} />
                <Badge
                  label={consent.isActive ? t('consentStatusActive') : t('consentStatusInactive')}
                  tone={consent.isActive ? 'ink' : 'neutral'}
                  icon={consent.isActive ? 'checkmark-circle' : 'remove-circle-outline'}
                />
              </View>
              <View style={{ gap: 2 }}>
                <Text accessibilityRole="header" style={[typography.title2, { color: consent.isActive ? INK : c.textPrimary }]}>
                  {t('consentTitle')}
                </Text>
                {givenOn ? (
                  <Text style={[typography.subhead, { color: consent.isActive ? c.tones.sage.fg : c.textSecondary }]}>
                    {t('consentGivenOn').replace('{date}', givenOn)}
                  </Text>
                ) : null}
              </View>
              <Text style={[typography.body, { color: consent.isActive ? INK : c.textSecondary }]}>{t('consentBody')}</Text>
              <Text style={[typography.footnote, { color: consent.isActive ? c.tones.sage.fg : c.textTertiary }]}>
                {t('consentVersionLabel').replace('{version}', TAKT_CONSENT_VERSION)}
              </Text>
            </Tile>
          </Animated.View>
        )}

        <ListGroup>
          <ListRow
            isFirst
            title={t('privacyNotice')}
            leading={
              <View style={[styles.rowIcon, { backgroundColor: c.surfaceRaised }]}>
                <Ionicons name="eye-outline" size={20} color={c.textPrimary} />
              </View>
            }
            onPress={() => router.push('/settings/privacy')}
          />
        </ListGroup>

        <Animated.View entering={enter(1)}>
          <SectionHeader title={t('withdrawConsent')} />
          <Card>
            <View style={styles.cardBody}>
              <Text style={[typography.body, { color: c.textSecondary }]}>{t('withdrawConsentHint')}</Text>
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
                <Animated.View entering={FadeIn.duration(220)} accessibilityRole="alert" style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={18} color={c.destructive} />
                  <Text style={[typography.subhead, { color: c.destructive, flex: 1 }]}>{error}</Text>
                </Animated.View>
              ) : null}
            </View>
          </Card>
        </Animated.View>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  cardBody: { padding: spacing(4.5), gap: spacing(3.5) },
  hero: { gap: spacing(3.5), padding: spacing(5.5), borderRadius: radius.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(3) },
  rowIcon: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
});
