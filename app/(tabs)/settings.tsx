import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedPressable,
  AnimatedSegmentedControl,
  Badge,
  Button,
  Card,
  ErrorState,
  ListGroup,
  ListRow,
  PageHeader,
  PageShell,
  SectionHeader,
  Stack,
  paletteConfigs,
  radius,
  spacing,
  typography,
  useTheme,
  useTokens,
  type ThemeMode,
  type ThemePalette,
} from '@/components/ui';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { ovokClient } from '@/lib/ovok-client';
import { useWithdrawConsent } from '@/lib/hooks/use-takt-mutations';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { env } from '@/lib/env';

const SNOOZE_OPTIONS = [5, 10, 15, 30] as const;

function SettingsIconBadge({
  name,
  color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: radius.md,
        backgroundColor: `${color}1F`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={17} color={color} />
    </View>
  );
}

export default function SettingsTabScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { themeMode, palette, setThemeMode, setPalette } = useTheme();
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
          <SectionHeader title={t('appearance')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(4) }}>
              <View style={{ gap: spacing(2) }}>
                <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('themeMode')}</Text>
                <AnimatedSegmentedControl
                  value={themeMode}
                  onChange={(next) => void setThemeMode(next as ThemeMode)}
                  options={[
                    { value: 'system', label: t('themeModeSystem') },
                    { value: 'light', label: t('themeModeLight') },
                    { value: 'dark', label: t('themeModeDark') },
                  ]}
                />
              </View>

              <View style={{ gap: spacing(2.5) }}>
                <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('themePalette')}</Text>
                <View style={{ gap: spacing(2) }}>
                  {(['amber', 'sage', 'indigo', 'plum'] as const).map((pKey) => {
                    const config = paletteConfigs[pKey];
                    const isSelected = palette === pKey;
                    return (
                      <AnimatedPressable
                        key={pKey}
                        onPress={() => void setPalette(pKey as ThemePalette)}
                        style={[
                          styles.paletteChip,
                          {
                            backgroundColor: isSelected ? c.surfaceRaised : c.surface,
                            borderColor: isSelected ? c.accent : c.separator,
                            borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                          },
                        ]}
                      >
                        <View style={[styles.paletteCircle, { backgroundColor: config.previewColor }]} />
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={[typography.headline, { color: c.textPrimary, fontSize: 15 }]}>
                            {config.name}
                          </Text>
                          <Text style={[typography.caption, { color: c.textSecondary }]}>
                            {config.description}
                          </Text>
                        </View>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={22} color={c.accent} />
                        ) : null}
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title={t('language')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <AnimatedSegmentedControl
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
              <AnimatedSegmentedControl
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

        {/* Care & Quality */}
        <View>
          <SectionHeader title={t('settingsCareCoordination')} />
          <ListGroup>
            <ListRow
              isFirst
              title={t('familySharingTitle')}
              subtitle={t('familySharingRouteSubtitle')}
              leading={<SettingsIconBadge name="people-outline" color="#8B5CF6" />}
              onPress={() => router.push('/settings/family-sharing' as never)}
            />
            <ListRow
              title={t('reminderTestTitle')}
              subtitle={t('reminderTestSubtitle')}
              leading={<SettingsIconBadge name="notifications-outline" color="#3B82F6" />}
              onPress={() => router.push('/settings/reminder-test')}
            />
            <ListRow
              title={t('reminderCertTitle')}
              leading={<SettingsIconBadge name="ribbon-outline" color="#F59E0B" />}
              onPress={() => router.push('/settings/reminder-certification')}
            />
            <ListRow
              title={t('reportReviewTitle')}
              leading={<SettingsIconBadge name="document-text-outline" color="#10B981" />}
              onPress={() => router.push('/settings/report-review')}
            />
          </ListGroup>
        </View>

        {/* Privacy & Security */}
        <View>
          <SectionHeader title={t('settingsPrivacySecurity')} />
          <ListGroup>
            <ListRow
              isFirst
              title={t('privacyNotice')}
              leading={<SettingsIconBadge name="shield-checkmark-outline" color="#059669" />}
              onPress={() => router.push('/settings/privacy')}
            />
            <ListRow
              title={t('sessionQaTitle')}
              leading={<SettingsIconBadge name="key-outline" color="#6366F1" />}
              onPress={() => router.push('/settings/session-security')}
            />
            <ListRow
              title={t('consentAuditTitle')}
              leading={<SettingsIconBadge name="lock-closed-outline" color="#D97706" />}
              onPress={() => router.push('/settings/consent-audit')}
            />
            <ListRow
              title={t('isolationTitle')}
              leading={<SettingsIconBadge name="cube-outline" color="#64748B" />}
              onPress={() => router.push('/settings/isolation')}
            />
          </ListGroup>
        </View>

        {/* Standards & Compliance */}
        <View>
          <SectionHeader title={t('settingsCompliance')} />
          <ListGroup>
            <ListRow
              isFirst
              title={t('releaseHubTitle')}
              leading={<SettingsIconBadge name="sparkles-outline" color="#EC4899" />}
              onPress={() => router.push('/settings/release-hub' as never)}
            />
            <ListRow
              title={t('readinessTitle')}
              leading={<SettingsIconBadge name="checkmark-circle-outline" color="#0D9488" />}
              onPress={() => router.push('/settings/readiness')}
            />
            <ListRow
              title={t('a11yPassTitle')}
              leading={<SettingsIconBadge name="accessibility-outline" color="#0284C7" />}
              onPress={() => router.push('/settings/accessibility-pass' as never)}
            />
            <ListRow
              title={t('imprint')}
              leading={<SettingsIconBadge name="information-circle-outline" color="#6B7280" />}
              onPress={() => router.push('/settings/imprint')}
            />
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

const styles = StyleSheet.create({
  paletteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3),
    borderRadius: radius.md,
  },
  paletteCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
  },
});

