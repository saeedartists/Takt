import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedPressable,
  AnimatedSegmentedControl,
  Button,
  Card,
  ErrorState,
  INK,
  PAPER,
  PageShell,
  Stack,
  TaktMark,
  Tile,
  TileIcon,
  font,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
  type IconName,
  type TileTone,
} from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';
import { FOLLOW_UP_OPTIONS, GRACE_OPTIONS, useReminderPreferences, type FollowUpMinutes, type GraceHours } from '@/lib/takt/preferences';
import { ALARM_SOUND, readReminderPermissionStatus } from '@/lib/takt/reminders';
import {
  alarmsAvailable,
  getAlarmAuthorization,
  requestAlarmAuthorization,
  scheduleAlarm,
  type AlarmAuthorization,
} from '../../modules/takt-alarm';

const SNOOZE_OPTIONS = [5, 10, 15, 30] as const;

type PermissionStatus = Awaited<ReturnType<typeof readReminderPermissionStatus>>;
type MessageKey = Parameters<ReturnType<typeof useLocale>['t']>[0];

/* Permission state as a tile: sage = on, butter = needs attention, plain card otherwise. Icon + words, never colour alone. */
const PERMISSION_TILE: Record<PermissionStatus, { key: MessageKey; tone: TileTone; icon: IconName }> = {
  granted: { key: 'notificationStatusGranted', tone: 'sage', icon: 'checkmark-circle' },
  denied: { key: 'notificationStatusDenied', tone: 'butter', icon: 'alert-circle' },
  undetermined: { key: 'notificationStatusUndetermined', tone: 'surface', icon: 'help-circle-outline' },
  unavailable: { key: 'notificationStatusUnavailable', tone: 'surface', icon: 'notifications-off-outline' },
};

/** Sample dose for the lock-screen preview. */
const SAMPLE = { label: 'Ramipril', suffix: ' 5 mg', time: '08:00' };

/** The lock-screen banner, crossfading between the named and the private wording. */
function NotificationPreview({ hideNames }: { hideNames: boolean }) {
  const { t } = useLocale();
  const { duration } = useMotion();
  const hidden = useSharedValue(hideNames ? 1 : 0);
  useEffect(() => {
    hidden.value = withTiming(hideNames ? 1 : 0, { duration: duration.slow });
  }, [hidden, hideNames, duration.slow]);
  const named = useAnimatedStyle(() => ({ opacity: 1 - hidden.value, transform: [{ translateY: hidden.value * -4 }] }));
  const priv = useAnimatedStyle(() => ({ opacity: hidden.value, transform: [{ translateY: (1 - hidden.value) * 4 }] }));

  const fill = (template: string) =>
    template.replace('{label}', SAMPLE.label).replace('{suffix}', SAMPLE.suffix).replace('{time}', SAMPLE.time);
  const bodyNamed = fill(t('reminderNotificationBody'));
  const bodyPrivate = fill(t('reminderNotificationBodyPrivate'));

  return (
    <View
      style={styles.banner}
      accessible
      accessibilityLabel={`${t('reminderNotificationTitle')}, ${hideNames ? bodyPrivate : bodyNamed}`}
    >
      <TaktMark size={36} />
      <View style={styles.bannerText}>
        <View style={styles.bannerHead}>
          <Text style={[typography.subhead, { color: INK, fontFamily: font.bold }]}>{t('appName')}</Text>
          <Text style={[typography.footnote, { color: '#464B54' }]}>{t('reminderPreviewNow')}</Text>
        </View>
        <Text style={[typography.headline, { color: INK }]}>{t('reminderNotificationTitle')}</Text>
        <View>
          <Animated.Text numberOfLines={1} style={[typography.subhead, { color: '#464B54' }, named]}>
            {bodyNamed}
          </Animated.Text>
          <Animated.Text numberOfLines={1} style={[typography.subhead, styles.overlay, { color: '#464B54' }, priv]}>
            {bodyPrivate}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

/** Snooze chips: the ink fill glides between choices. */
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { c } = useTokens();
  const { duration } = useMotion();
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: duration.base });
  }, [on, selected, duration.base]);
  const fill = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scale: 0.85 + on.value * 0.15 }] }));
  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      haptic="light"
      scaleTo={0.95}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: c.surfaceRaised }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.chipFill, { backgroundColor: c.ink }, fill]} />
      <Text style={[typography.headline, { color: selected ? c.onInk : c.textPrimary, fontFamily: selected ? font.bold : font.semibold }]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

/** One preference: label, optional hint, then its control. Hairline between blocks. */
function Pref({ label, hint, first, children }: { label: string; hint?: string; first?: boolean; children: ReactNode }) {
  const { c } = useTokens();
  return (
    <View style={[styles.pref, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}>
      <Text style={[typography.headline, { color: c.textPrimary }]}>{label}</Text>
      {children}
      {hint ? <Text style={[typography.footnote, { color: c.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

/** Everything about reminders in one place: timing, sound, privacy, grace, permission and a test. */
export default function RemindersSettingsScreen() {
  const { c } = useTokens();
  const { enter } = useMotion();
  const { t } = useLocale();
  const prefs = useReminderPreferences();
  const [permission, setPermission] = useState<PermissionStatus>('unavailable');
  const [test, setTest] = useState<'idle' | 'sent' | 'error'>('idle');
  const [alarmAuth, setAlarmAuth] = useState<AlarmAuthorization>('unavailable');
  const params = useLocalSearchParams<{ test?: string }>();

  // Re-read on focus and when the app returns from the system settings sheet.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () => {
        void readReminderPermissionStatus().then((next) => {
          if (active) setPermission(next);
        });
        void getAlarmAuthorization().then((next) => {
          if (active) setAlarmAuth(next);
        });
      };
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

  const sendTest = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('testReminderTitle'),
          body: t('testReminderBody'),
          sound: prefs.data?.sound === false ? false : ALARM_SOUND,
          // Same shape as a dose reminder, so the spoken reminder is tested too.
          data: { route: '/(tabs)/today', kind: 'dose', doseKey: 'test', requestRef: 'test', label: t('testReminderLabel') },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
      });
      // The real alarm too, a few seconds later, so the silent-mode ring can be checked with the app closed.
      if (prefs.data?.sound !== false && prefs.data?.alarm !== false && alarmAuth === 'authorized') {
        await scheduleAlarm({
          epochSeconds: Date.now() / 1000 + 10,
          title: t('testReminderTitle'),
          stopLabel: t('alarmStop'),
          openLabel: t('alarmOpen'),
          soundName: ALARM_SOUND,
        });
      }
      setTest('sent');
    } catch {
      setTest('error');
    }
  };

  // Dev hook: `xcrun simctl openurl booted "takt://settings/reminders?test=alarm"` fires the test without tapping.
  useEffect(() => {
    if (__DEV__ && params.test === 'alarm' && prefs.data) void sendTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.test, prefs.data, alarmAuth]);

  const setAlarm = async (on: boolean) => {
    await prefs.setAlarm(on);
    if (on && alarmAuth === 'notDetermined') setAlarmAuth(await requestAlarmAuthorization());
  };

  const status = PERMISSION_TILE[permission];
  const snooze = prefs.data?.snoozeMinutes ?? 15;

  return (
    <PageShell>
      <Stack>
        {/* Hero: sky = reminders. The banner shows what the lock screen will say. */}
        <Animated.View entering={enter(0)}>
          <Tile tone="sky" style={styles.hero}>
            <Text accessibilityRole="header" style={[typography.title2, { color: INK }]}>
              {t('remindersLead')}
            </Text>
            <NotificationPreview hideNames={Boolean(prefs.data?.hideNamesInReminders)} />
            <Text style={[typography.footnote, { color: c.tones.sky.fg }]}>{t('reminderPreviewHint')}</Text>
          </Tile>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <Tile tone={status.tone} style={styles.statusTile}>
            <View style={styles.statusRow}>
              {status.tone === 'surface' ? (
                <View style={[styles.quietIcon, { backgroundColor: c.surfaceRaised }]}>
                  <Ionicons name={status.icon} size={22} color={c.textPrimary} />
                </View>
              ) : (
                <TileIcon name={status.icon} size={40} />
              )}
              <View style={styles.flex}>
                <Text style={[typography.headline, { color: status.tone === 'surface' ? c.textPrimary : INK }]}>
                  {t('notificationPermissionLabel')}
                </Text>
                <Text style={[typography.subhead, { color: status.tone === 'surface' ? c.textSecondary : c.tones[status.tone as 'sage'].fg }]}>
                  {t(status.key)}
                </Text>
              </View>
            </View>
            {Platform.OS === 'web' ? (
              <Text style={[typography.footnote, { color: status.tone === 'surface' ? c.textSecondary : INK }]}>
                {t('notificationsWebHint')}
              </Text>
            ) : permission !== 'granted' ? (
              <Button
                kind="primary"
                size="sm"
                onTone={status.tone !== 'surface'}
                label={t('openSystemSettings')}
                icon={<Ionicons name="open-outline" size={16} color={status.tone !== 'surface' ? PAPER : c.onInk} />}
                onPress={() => void Linking.openSettings()}
              />
            ) : null}
          </Tile>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <Card>
            <Pref first label={t('snoozeAfter')}>
              <View accessibilityRole="radiogroup" style={styles.chips}>
                {SNOOZE_OPTIONS.map((minutes) => (
                  <Chip
                    key={minutes}
                    label={`${minutes}m`}
                    selected={snooze === minutes}
                    onPress={() => void prefs.setSnoozeMinutes(minutes)}
                  />
                ))}
              </View>
            </Pref>

            <Pref label={t('reminderSoundLabel')}>
              <AnimatedSegmentedControl
                value={prefs.data?.sound === false ? 'off' : 'on'}
                onChange={(next) => void prefs.setSound(next === 'on')}
                options={[
                  { value: 'on', label: t('reminderSoundOn') },
                  { value: 'off', label: t('reminderSoundOff') },
                ]}
              />
            </Pref>

            {Platform.OS === 'ios' ? (
              <Pref
                label={t('alarmModeLabel')}
                hint={
                  !alarmsAvailable()
                    ? t('alarmModeUnavailable')
                    : alarmAuth === 'denied'
                      ? t('alarmModeDenied')
                      : t('alarmModeHint')
                }
              >
                {alarmsAvailable() ? (
                  <AnimatedSegmentedControl
                    value={prefs.data?.alarm === false ? 'off' : 'on'}
                    onChange={(next) => void setAlarm(next === 'on')}
                    options={[
                      { value: 'on', label: t('alarmModeOn') },
                      { value: 'off', label: t('alarmModeOff') },
                    ]}
                  />
                ) : null}
                {alarmAuth === 'denied' ? (
                  <Button
                    kind="secondary"
                    label={t('openSystemSettings')}
                    icon={<Ionicons name="open-outline" size={16} color={c.textPrimary} />}
                    onPress={() => void Linking.openSettings()}
                  />
                ) : null}
              </Pref>
            ) : null}

            <Pref label={t('reminderPrivacyLabel')}>
              <AnimatedSegmentedControl
                value={prefs.data?.hideNamesInReminders ? 'hide' : 'show'}
                onChange={(next) => void prefs.setHideNames(next === 'hide')}
                options={[
                  { value: 'show', label: t('reminderPrivacyShow') },
                  { value: 'hide', label: t('reminderPrivacyHide') },
                ]}
              />
            </Pref>

            <Pref label={t('voiceReminderLabel')} hint={t('voiceReminderHint')}>
              <AnimatedSegmentedControl
                value={prefs.data?.voice === false ? 'off' : 'on'}
                onChange={(next) => void prefs.setVoice(next === 'on')}
                options={[
                  { value: 'on', label: t('voiceReminderOn') },
                  { value: 'off', label: t('voiceReminderOff') },
                ]}
              />
            </Pref>

            <Pref label={t('graceWindowLabel')}>
              <AnimatedSegmentedControl
                value={(prefs.data?.graceHours ?? 4).toString()}
                onChange={(next) => void prefs.setGraceHours(Number.parseInt(next, 10) as GraceHours)}
                options={GRACE_OPTIONS.map((hours) => ({
                  value: hours.toString(),
                  label: t('graceWindowHours').replace('{hours}', hours.toString()),
                }))}
              />
            </Pref>

            <Pref label={t('followUpLabel')} hint={t('followUpHint')}>
              <AnimatedSegmentedControl
                value={String(prefs.data?.followUpMinutes ?? 30)}
                onChange={(next) => void prefs.setFollowUpMinutes(Number.parseInt(next, 10) as FollowUpMinutes)}
                options={FOLLOW_UP_OPTIONS.map((minutes) => ({
                  value: String(minutes),
                  label: minutes === 0 ? t('followUpOff') : t('followUpMinutes').replace('{minutes}', String(minutes)),
                }))}
              />
            </Pref>
          </Card>
          {prefs.saveError ? <ErrorState description={t('saveReminderPrefError')} /> : null}
        </Animated.View>

        {Platform.OS === 'web' ? null : (
          <Animated.View entering={enter(3)} style={styles.testBlock}>
            <Button
              kind="secondary"
              label={t('sendTestReminder')}
              icon={<Ionicons name="paper-plane-outline" size={18} color={c.textPrimary} />}
              disabled={permission !== 'granted'}
              onPress={() => void sendTest()}
            />
            {test === 'sent' ? (
              <Animated.View entering={FadeIn} style={styles.feedback}>
                <Ionicons name="checkmark-circle" size={18} color={c.success} />
                <Text style={[typography.subhead, styles.flex, { color: c.textPrimary }]}>{t('testReminderSent')}</Text>
              </Animated.View>
            ) : null}
            {test === 'error' ? (
              <Animated.View entering={FadeIn} accessibilityRole="alert" style={styles.feedback}>
                <Ionicons name="alert-circle" size={18} color={c.destructive} />
                <Text style={[typography.subhead, styles.flex, { color: c.destructive }]}>{t('testReminderError')}</Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        )}
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  hero: { gap: spacing(3), padding: spacing(4.5), borderRadius: radius.xxl },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(3),
    padding: spacing(3.5),
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  bannerText: { flex: 1, minWidth: 0 },
  bannerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0 },
  statusTile: { gap: spacing(3) },
  quietIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  pref: { paddingHorizontal: spacing(4), paddingVertical: spacing(3.5), gap: spacing(2.5) },
  chips: { flexDirection: 'row', gap: spacing(2) },
  chip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipFill: { borderRadius: radius.full },
  testBlock: { gap: spacing(2) },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingHorizontal: spacing(1) },
});
