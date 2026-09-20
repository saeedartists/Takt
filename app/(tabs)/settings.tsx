import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { AppState, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
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
  radius,
  spacing,
  typography,
  useMotion,
  useTheme,
  useTokens,
  type BadgeTone,
  type ThemeMode,
} from '@/components/ui';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { ovokClient } from '@/lib/ovok-client';
import { useWithdrawConsent } from '@/lib/hooks/use-takt-mutations';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { readReminderPermissionStatus } from '@/lib/takt/reminders';
import { env } from '@/lib/env';

const SNOOZE_OPTIONS = [5, 10, 15, 30] as const;

type PermissionStatus = Awaited<ReturnType<typeof readReminderPermissionStatus>>;
type MessageKey = Parameters<ReturnType<typeof useLocale>['t']>[0];

const PERMISSION_BADGE: Record<PermissionStatus, { key: MessageKey; tone: BadgeTone }> = {
  granted: { key: 'notificationStatusGranted', tone: 'success' },
  denied: { key: 'notificationStatusDenied', tone: 'warning' },
  undetermined: { key: 'notificationStatusUndetermined', tone: 'neutral' },
  unavailable: { key: 'notificationStatusUnavailable', tone: 'neutral' },
};

/** Internal QA boards. Rendered only in dev / mock builds. */
const DEVELOPER_BOARDS: { key: MessageKey; route: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'reminderTestTitle', route: '/settings/reminder-test', icon: 'notifications-outline' },
  { key: 'reminderCertTitle', route: '/settings/reminder-certification', icon: 'ribbon-outline' },
  { key: 'reportReviewTitle', route: '/settings/report-review', icon: 'document-text-outline' },
  { key: 'sessionQaTitle', route: '/settings/session-security', icon: 'key-outline' },
  { key: 'consentAuditTitle', route: '/settings/consent-audit', icon: 'lock-closed-outline' },
  { key: 'isolationTitle', route: '/settings/isolation', icon: 'cube-outline' },
  { key: 'releaseHubTitle', route: '/settings/release-hub', icon: 'sparkles-outline' },
  { key: 'readinessTitle', route: '/settings/readiness', icon: 'checkmark-circle-outline' },
  { key: 'a11yPassTitle', route: '/settings/accessibility-pass', icon: 'accessibility-outline' },
];

function SettingsIconBadge({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: string }) {
  const { c } = useTokens();
  // Alpha suffix only works on hex tokens; rgba tokens (textSecondary) fall back to the raised surface.
  const backgroundColor = color.startsWith('#') ? `${color}1F` : c.surfaceRaised;
  return (
    <View style={[styles.iconBadge, { backgroundColor }]}>
      <Ionicons name={name} size={17} color={color} />
    </View>
  );
}

function Section({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  const { enter } = useMotion();
  return (
    <Animated.View entering={enter(index)}>
      <SectionHeader title={title} />
      {children}
    </Animated.View>
  );
}

/** Two-step destructive action: trigger button, then an inline confirm row. No Alert.alert (web no-op). */
function ConfirmExpander({
  open,
  onOpen,
  onCancel,
  onConfirm,
  triggerLabel,
  triggerKind = 'secondary',
  body,
  loading = false,
  disabled = false,
}: {
  open: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  triggerLabel: string;
  triggerKind?: 'secondary' | 'destructive';
  body: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTokens();
  const { t } = useLocale();
  const { duration } = useMotion();
  return (
    <Animated.View layout={LinearTransition}>
      {open ? (
        <Animated.View entering={FadeIn.duration(duration.fast)} style={{ gap: spacing(3) }}>
          <Text style={[typography.subhead, { color: c.textPrimary }]}>{body}</Text>
          <View style={styles.confirmRow}>
            <View style={{ flex: 1 }}>
              <Button kind="secondary" label={t('cancel')} onPress={onCancel} disabled={loading} />
            </View>
            <View style={{ flex: 1 }}>
              <Button kind="destructive" label={triggerLabel} onPress={onConfirm} loading={loading} />
            </View>
          </View>
        </Animated.View>
      ) : (
        <Button kind={triggerKind} label={triggerLabel} onPress={onOpen} disabled={disabled} />
      )}
    </Animated.View>
  );
}

export default function SettingsTabScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { enter } = useMotion();
  const { themeMode, setThemeMode } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const patient = usePrimaryPatient();
  const withdrawConsent = useWithdrawConsent();
  const reminderPrefs = useReminderPreferences();
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [permission, setPermission] = useState<PermissionStatus>('unavailable');

  // Re-read on focus and when the app returns from the system settings sheet.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () =>
        void readReminderPermissionStatus().then((next) => {
          if (active) setPermission(next);
        });
      refresh();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        active = false;
        sub.remove();
      };
    }, []),
  );

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

  const showDeveloper = __DEV__ || env.ovokMockEnabled;
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const runtimeVersion = Constants.expoConfig?.runtimeVersion;
  const build = typeof runtimeVersion === 'string' ? runtimeVersion : Constants.expoConfig?.ios?.buildNumber;
  const permissionBadge = PERMISSION_BADGE[permission];

  return (
    <PageShell>
      <PageHeader title={t('settings')} />

      <Stack>
        <Section index={0} title={t('appearance')}>
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

            </View>
          </Card>
        </Section>

        <Section index={1} title={t('language')}>
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
            </View>
          </Card>
        </Section>

        <Section index={2} title={t('reminders')}>
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
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('reminderSoundLabel')}</Text>
              <AnimatedSegmentedControl
                value={reminderPrefs.data?.sound === false ? 'off' : 'on'}
                onChange={(next) => void reminderPrefs.setSound(next === 'on')}
                options={[
                  { value: 'on', label: t('reminderSoundOn') },
                  { value: 'off', label: t('reminderSoundOff') },
                ]}
              />
            </View>
          </Card>
          {reminderPrefs.saveError ? <ErrorState description={t('saveReminderPrefError')} /> : null}
        </Section>

        <Section index={3} title={t('notificationsSection')}>
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <View style={styles.permissionRow}>
                <SettingsIconBadge name="notifications-outline" color={c.accent} />
                <Text style={[typography.body, { color: c.textPrimary, flex: 1, minWidth: 0 }]}>
                  {t('notificationPermissionLabel')}
                </Text>
                <Badge label={t(permissionBadge.key)} tone={permissionBadge.tone} />
              </View>
              {Platform.OS === 'web' ? (
                <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('notificationsWebHint')}</Text>
              ) : (
                <Button
                  kind="secondary"
                  size="sm"
                  label={t('openSystemSettings')}
                  icon={<Ionicons name="open-outline" size={16} color={c.textPrimary} />}
                  onPress={() => void Linking.openSettings()}
                />
              )}
            </View>
          </Card>
        </Section>

        <Section index={4} title={t('careSection')}>
          <ListGroup>
            <ListRow
              isFirst
              title={t('familySharingTitle')}
              subtitle={t('familySharingRouteSubtitle')}
              leading={<SettingsIconBadge name="people-outline" color={c.accent} />}
              onPress={() => router.push('/settings/family-sharing' as never)}
            />
          </ListGroup>
        </Section>

        <Section index={5} title={t('legal')}>
          <ListGroup>
            <ListRow
              isFirst
              title={t('privacyNotice')}
              leading={<SettingsIconBadge name="shield-checkmark-outline" color={c.success} />}
              onPress={() => router.push('/settings/privacy')}
            />
            <ListRow
              title={t('imprint')}
              leading={<SettingsIconBadge name="information-circle-outline" color={c.textSecondary} />}
              onPress={() => router.push('/settings/imprint')}
            />
          </ListGroup>
        </Section>

        {env.ovokMockEnabled ? null : (
          <Section index={6} title={t('accountSectionTitle')}>
            <Card>
              <View style={{ padding: spacing(4) }}>
                <ConfirmExpander
                  open={confirmSignOut}
                  onOpen={() => setConfirmSignOut(true)}
                  onCancel={() => setConfirmSignOut(false)}
                  onConfirm={signOut}
                  triggerLabel={t('signOut')}
                  body={t('signOutConfirmBody')}
                />
              </View>
            </Card>
          </Section>
        )}

        <Animated.View entering={enter(7)}>
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('safetyNote')}</Text>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('aboutTakt')}</Text>
              <ConfirmExpander
                open={confirmWithdraw}
                onOpen={() => setConfirmWithdraw(true)}
                onCancel={() => setConfirmWithdraw(false)}
                onConfirm={() => void withdraw()}
                triggerLabel={t('withdrawConsent')}
                triggerKind="destructive"
                body={t('withdrawConsentConfirmBody')}
                loading={withdrawConsent.isPending}
                disabled={patient.isLoading}
              />
              {withdrawError ? (
                <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>
                  {withdrawError}
                </Text>
              ) : null}
            </View>
          </Card>
        </Animated.View>

        {showDeveloper ? (
          <Section index={8} title={t('developerSection')}>
            <ListGroup>
              {DEVELOPER_BOARDS.map((board, index) => (
                <ListRow
                  key={board.route}
                  isFirst={index === 0}
                  title={t(board.key)}
                  leading={<SettingsIconBadge name={board.icon} color={c.textSecondary} />}
                  onPress={() => router.push(board.route as never)}
                />
              ))}
            </ListGroup>
            <Text style={[typography.footnote, styles.footnote, { color: c.textTertiary }]}>
              {t('developerSectionFootnote')}
            </Text>
          </Section>
        ) : null}

        <Text style={[typography.caption, styles.version, { color: c.textTertiary }]}>
          {t('versionLabel').replace('{version}', version)}
          {build ? ` · ${t('buildLabel').replace('{build}', build)}` : ''}
        </Text>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  confirmRow: {
    flexDirection: 'row',
    gap: spacing(2),
  },
  footnote: {
    marginTop: spacing(2),
    paddingHorizontal: spacing(1),
  },
  version: {
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
