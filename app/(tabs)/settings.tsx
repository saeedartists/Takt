import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge,
  Card,
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
} from '@/components/ui';
import { ConfirmExpander } from '@/components/takt/confirm-expander';
import { useConsentStatus } from '@/lib/hooks/use-consent-status';
import { useAccountEmail, useFamilySharingGrants } from '@/lib/hooks/use-family-sharing-grants';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { ovokClient } from '@/lib/ovok-client';
import { useLocale } from '@/lib/takt/l10n';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { readReminderPermissionStatus } from '@/lib/takt/reminders';
import { env } from '@/lib/env';

type PermissionStatus = Awaited<ReturnType<typeof readReminderPermissionStatus>>;
type MessageKey = Parameters<ReturnType<typeof useLocale>['t']>[0];

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

function RowIcon({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: string }) {
  const { c } = useTokens();
  // Alpha suffix only works on hex tokens; rgba tokens (textSecondary) fall back to the raised surface.
  const backgroundColor = color.startsWith('#') ? `${color}1F` : c.surfaceRaised;
  return (
    <View style={[styles.iconBadge, { backgroundColor }]}>
      <Ionicons name={name} size={17} color={color} />
    </View>
  );
}

function Section({ index, title, children }: { index: number; title?: string; children: ReactNode }) {
  const { enter } = useMotion();
  return (
    <Animated.View entering={enter(index)}>
      {title ? <SectionHeader title={title} /> : null}
      {children}
    </Animated.View>
  );
}

/*
 * Settings — every feature that is not daily, as named rows with their
 * current value. Controls live one level down (Reminders, Appearance,
 * Consent) so nothing on this page has to be interpreted.
 */
export default function SettingsTabScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { themeMode } = useTheme();
  const { locale, t, formatDate } = useLocale();
  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const email = useAccountEmail();
  const grants = useFamilySharingGrants(patientRef);
  const consent = useConsentStatus(patientRef);
  const prefs = useReminderPreferences();
  const [permission, setPermission] = useState<PermissionStatus>('unavailable');
  const [confirmSignOut, setConfirmSignOut] = useState(false);

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

  const signOut = () => {
    ovokClient.clearActiveLogin();
    router.replace('/auth/sign-in' as never);
  };

  const name = patient.data?.name?.[0];
  const fullName = [name?.given?.[0], name?.family].filter(Boolean).join(' ');
  const initials = [name?.given?.[0]?.[0], name?.family?.[0]].filter(Boolean).join('').toUpperCase();

  const remindersSummary = [
    prefs.data?.sound === false ? t('reminderSoundOff') : t('reminderSoundOn'),
    t('snoozeSummary').replace('{minutes}', String(prefs.data?.snoozeMinutes ?? 15)),
    t('graceWindowHours').replace('{hours}', String(prefs.data?.graceHours ?? 4)),
  ].join(' · ');

  const activeGrants = grants.grants.filter((grant) => grant.status === 'granted').length;
  const familySummary =
    activeGrants === 0
      ? t('familySharingOff')
      : activeGrants === 1
        ? t('familySharingOneRelative')
        : t('familySharingRelatives').replace('{count}', String(activeGrants));

  const themeLabel =
    themeMode === 'light' ? t('themeModeLight') : themeMode === 'dark' ? t('themeModeDark') : t('themeModeSystem');
  const appearanceSummary = `${themeLabel} · ${locale === 'de' ? 'Deutsch' : 'English'}`;

  const consentSummary = consent.isActive
    ? consent.currentAt
      ? t('consentGivenOn').replace(
          '{date}',
          formatDate(new Date(consent.currentAt), { year: 'numeric', month: 'short', day: 'numeric' }),
        )
      : t('consentStatusActive')
    : t('consentStatusInactive');

  const showDeveloper = __DEV__;
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const runtimeVersion = Constants.expoConfig?.runtimeVersion;
  const build = typeof runtimeVersion === 'string' ? runtimeVersion : Constants.expoConfig?.ios?.buildNumber;

  return (
    <PageShell>
      <PageHeader title={t('settings')} />

      <Stack>
        <Section index={0}>
          <ListGroup>
            <ListRow
              isFirst
              title={fullName || t('profileSignedIn')}
              subtitle={email ?? (fullName ? t('profileSignedIn') : undefined)}
              leading={
                <View style={[styles.avatar, { backgroundColor: `${c.accent}1F` }]}>
                  <Text style={[typography.headline, { color: c.accent }]}>{initials || '·'}</Text>
                </View>
              }
            />
          </ListGroup>
        </Section>

        <Section index={1}>
          <ListGroup>
            <ListRow
              isFirst
              title={t('reminders')}
              subtitle={remindersSummary}
              meta={permission === 'denied' ? <Badge label={t('notificationStatusDenied')} tone="warning" /> : undefined}
              leading={<RowIcon name="notifications-outline" color={c.accent} />}
              onPress={() => router.push('/settings/reminders' as never)}
            />
          </ListGroup>
        </Section>

        <Section index={2} title={t('careSection')}>
          <ListGroup>
            <ListRow
              isFirst
              title={t('familySharingRouteTitle')}
              subtitle={familySummary}
              leading={<RowIcon name="people-outline" color={c.accent} />}
              onPress={() => router.push('/settings/family-sharing' as never)}
            />
            <ListRow
              title={t('report')}
              subtitle={t('reportRouteSubtitle')}
              leading={<RowIcon name="document-text-outline" color={c.accent} />}
              onPress={() => router.push('/report')}
            />
          </ListGroup>
        </Section>

        <Section index={3}>
          <ListGroup>
            <ListRow
              isFirst
              title={t('appearance')}
              subtitle={appearanceSummary}
              leading={<RowIcon name="color-palette-outline" color={c.accent} />}
              onPress={() => router.push('/settings/appearance' as never)}
            />
          </ListGroup>
        </Section>

        <Section index={4} title={t('legal')}>
          <ListGroup>
            <ListRow
              isFirst
              title={t('consentRouteTitle')}
              subtitle={consentSummary}
              leading={<RowIcon name="shield-checkmark-outline" color={c.success} />}
              onPress={() => router.push('/settings/consent' as never)}
            />
            <ListRow
              title={t('privacyNotice')}
              leading={<RowIcon name="lock-closed-outline" color={c.textSecondary} />}
              onPress={() => router.push('/settings/privacy')}
            />
            <ListRow
              title={t('imprint')}
              leading={<RowIcon name="information-circle-outline" color={c.textSecondary} />}
              onPress={() => router.push('/settings/imprint')}
            />
          </ListGroup>
        </Section>

        {env.ovokMockEnabled ? null : (
          <Section index={5} title={t('accountSectionTitle')}>
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

        {showDeveloper ? (
          <Section index={6} title={t('developerSection')}>
            <ListGroup>
              {DEVELOPER_BOARDS.map((board, index) => (
                <ListRow
                  key={board.route}
                  isFirst={index === 0}
                  title={t(board.key)}
                  leading={<RowIcon name={board.icon} color={c.textSecondary} />}
                  onPress={() => router.push(board.route as never)}
                />
              ))}
            </ListGroup>
            <Text style={[typography.footnote, styles.footnote, { color: c.textTertiary }]}>
              {t('developerSectionFootnote')}
            </Text>
          </Section>
        ) : null}

        <View style={styles.footer}>
          <Text style={[typography.footnote, { color: c.textTertiary, textAlign: 'center' }]}>{t('safetyNote')}</Text>
          <Text style={[typography.caption, { color: c.textTertiary, textAlign: 'center' }]}>
            {t('versionLabel').replace('{version}', version)}
            {build ? ` · ${t('buildLabel').replace('{build}', build)}` : ''}
          </Text>
        </View>
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: { marginTop: spacing(2), paddingHorizontal: spacing(1) },
  footer: { gap: spacing(2), paddingHorizontal: spacing(2), paddingTop: spacing(2) },
});
