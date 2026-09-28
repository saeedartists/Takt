import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge,
  INK,
  ListGroup,
  ListRow,
  PageHeader,
  PageShell,
  SectionHeader,
  Stack,
  Tile,
  TileIcon,
  font,
  radius,
  spacing,
  typography,
  useMotion,
  useTheme,
  useTileColors,
  useTokens,
  type IconName,
  type TileTone,
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
const DEVELOPER_BOARDS: { key: MessageKey; route: string; icon: IconName }[] = [
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

/** Plain ink glyph in a quiet circle: list rows stay calm next to the pastel tiles. */
function RowIcon({ name }: { name: IconName }) {
  const { c } = useTokens();
  return (
    <View style={[styles.rowIcon, { backgroundColor: c.surfaceRaised }]}>
      <Ionicons name={name} size={20} color={c.textPrimary} />
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

/** One bento block: tone = meaning, icon top-left, title + live value underneath. */
function SettingsTile({
  index,
  tone,
  icon,
  title,
  value,
  extra,
  onPress,
}: {
  index: number;
  tone: TileTone;
  icon: IconName;
  title: string;
  value: string;
  extra?: ReactNode;
  onPress: () => void;
}) {
  const { enter } = useMotion();
  const { fg } = useTileColors(tone);
  return (
    <Animated.View entering={enter(index)} style={styles.tileCell}>
      <Tile tone={tone} onPress={onPress} accessibilityLabel={`${title}, ${value}`} style={styles.tile}>
        <TileIcon name={icon} size={44} />
        <View style={styles.tileText}>
          <Text style={[typography.headline, styles.tileTitle]}>{title}</Text>
          <Text style={[typography.subhead, { color: fg }]}>{value}</Text>
          {extra}
        </View>
      </Tile>
    </Animated.View>
  );
}

/*
 * Settings — who you are, then the four things people change most as
 * pastel tiles (each tone keeps its one meaning), then legal and account
 * rows. Controls live one level down so nothing here needs interpreting.
 */
export default function SettingsTabScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { enter } = useMotion();
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
        {/* Profile: lilac is the "you / profile" tone. */}
        <Animated.View entering={enter(0)}>
          <Tile tone="lilac" style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={[typography.title2, { color: INK }]}>{initials || '·'}</Text>
            </View>
            <View style={styles.profileText}>
              <Text numberOfLines={1} style={[typography.title3, { color: INK }]}>
                {fullName || t('profileSignedIn')}
              </Text>
              {email || fullName ? (
                <Text numberOfLines={1} style={[typography.subhead, { color: c.tones.lilac.fg }]}>
                  {email ?? t('profileSignedIn')}
                </Text>
              ) : null}
            </View>
          </Tile>
        </Animated.View>

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <SettingsTile
              index={1}
              tone="sky"
              icon="notifications-outline"
              title={t('reminders')}
              value={remindersSummary}
              extra={
                permission === 'denied' ? (
                  <View style={styles.tileBadge}>
                    <Badge size="sm" icon="alert-circle" label={t('notificationStatusDenied')} tone="warning" />
                  </View>
                ) : undefined
              }
              onPress={() => router.push('/settings/reminders' as never)}
            />
            <SettingsTile
              index={2}
              tone="accent"
              icon="color-palette-outline"
              title={t('appearance')}
              value={appearanceSummary}
              onPress={() => router.push('/settings/appearance' as never)}
            />
          </View>
          <View style={styles.gridRow}>
            <SettingsTile
              index={3}
              tone="sage"
              icon="people-outline"
              title={t('familySharingRouteTitle')}
              value={familySummary}
              onPress={() => router.push('/settings/family-sharing' as never)}
            />
            <SettingsTile
              index={4}
              tone="butter"
              icon="document-text-outline"
              title={t('report')}
              value={t('reportRouteSubtitle')}
              onPress={() => router.push('/report')}
            />
          </View>
        </View>

        <Section index={5} title={t('legal')}>
          <ListGroup>
            <ListRow
              isFirst
              title={t('consentRouteTitle')}
              subtitle={consentSummary}
              leading={<RowIcon name="shield-checkmark-outline" />}
              onPress={() => router.push('/settings/consent' as never)}
            />
            <ListRow
              title={t('privacyNotice')}
              leading={<RowIcon name="eye-outline" />}
              onPress={() => router.push('/settings/privacy')}
            />
            <ListRow
              title={t('imprint')}
              leading={<RowIcon name="information-circle-outline" />}
              onPress={() => router.push('/settings/imprint')}
            />
          </ListGroup>
        </Section>

        {env.ovokMockEnabled ? null : (
          <Section index={6}>
            <ConfirmExpander
              open={confirmSignOut}
              onOpen={() => setConfirmSignOut(true)}
              onCancel={() => setConfirmSignOut(false)}
              onConfirm={signOut}
              triggerLabel={t('signOut')}
              triggerKind="outline"
              body={t('signOutConfirmBody')}
            />
          </Section>
        )}

        {showDeveloper ? (
          <Section index={7} title={t('developerSection')}>
            <ListGroup>
              {DEVELOPER_BOARDS.map((board, index) => (
                <ListRow
                  key={board.route}
                  isFirst={index === 0}
                  title={t(board.key)}
                  leading={<RowIcon name={board.icon} />}
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
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing(3.5), borderRadius: radius.xxl },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1, minWidth: 0, gap: 2 },
  grid: { gap: spacing(3) },
  gridRow: { flexDirection: 'row', gap: spacing(3) },
  tileCell: { flex: 1, minWidth: 0 },
  tile: { flex: 1, gap: spacing(5), minHeight: 168, justifyContent: 'space-between' },
  tileText: { gap: 2 },
  tileTitle: { color: INK, fontFamily: font.bold, fontSize: 18 },
  tileBadge: { marginTop: spacing(2) },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: { marginTop: spacing(2), paddingHorizontal: spacing(1) },
  footer: { gap: spacing(2), paddingHorizontal: spacing(2), paddingTop: spacing(2) },
});
