import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedSegmentedControl,
  Badge,
  Button,
  Card,
  ErrorState,
  PageHeader,
  PageShell,
  SectionHeader,
  Stack,
  spacing,
  typography,
  useTokens,
  type BadgeTone,
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

const PERMISSION_BADGE: Record<PermissionStatus, { key: MessageKey; tone: BadgeTone }> = {
  granted: { key: 'notificationStatusGranted', tone: 'success' },
  denied: { key: 'notificationStatusDenied', tone: 'warning' },
  undetermined: { key: 'notificationStatusUndetermined', tone: 'neutral' },
  unavailable: { key: 'notificationStatusUnavailable', tone: 'neutral' },
};

/** Everything about reminders in one place: timing, sound, privacy, grace, permission and a test. */
export default function RemindersSettingsScreen() {
  const { c } = useTokens();
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

  const badge = PERMISSION_BADGE[permission];

  return (
    <PageShell>
      <PageHeader subtitle={t('remindersSettingsIntro')} />

      <Stack>
        <View>
          <SectionHeader title={t('notificationsSection')} />
          <Card>
            <View style={styles.cardBody}>
              <View style={styles.permissionRow}>
                <Ionicons name="notifications-outline" size={22} color={c.accent} />
                <Text style={[typography.body, { color: c.textPrimary, flex: 1, minWidth: 0 }]}>
                  {t('notificationPermissionLabel')}
                </Text>
                <Badge label={t(badge.key)} tone={badge.tone} />
              </View>
              {Platform.OS === 'web' ? (
                <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('notificationsWebHint')}</Text>
              ) : (
                <>
                  <Button
                    kind="secondary"
                    label={t('openSystemSettings')}
                    icon={<Ionicons name="open-outline" size={16} color={c.textPrimary} />}
                    onPress={() => void Linking.openSettings()}
                  />
                  <Button
                    kind="secondary"
                    label={t('sendTestReminder')}
                    icon={<Ionicons name="paper-plane-outline" size={16} color={c.textPrimary} />}
                    disabled={permission !== 'granted'}
                    onPress={() => void sendTest()}
                  />
                  {test === 'sent' ? (
                    <Text style={[typography.footnote, { color: c.success }]}>{t('testReminderSent')}</Text>
                  ) : null}
                  {test === 'error' ? (
                    <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>
                      {t('testReminderError')}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title={t('reminders')} />
          <Card>
            <View style={styles.cardBody}>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('snoozeAfter')}</Text>
              <AnimatedSegmentedControl
                value={(prefs.data?.snoozeMinutes ?? 15).toString()}
                onChange={(next) => void prefs.setSnoozeMinutes(Number.parseInt(next, 10))}
                options={SNOOZE_OPTIONS.map((minutes) => ({ value: minutes.toString(), label: `${minutes}m` }))}
              />
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('reminderSoundLabel')}</Text>
              <AnimatedSegmentedControl
                value={prefs.data?.sound === false ? 'off' : 'on'}
                onChange={(next) => void prefs.setSound(next === 'on')}
                options={[
                  { value: 'on', label: t('reminderSoundOn') },
                  { value: 'off', label: t('reminderSoundOff') },
                ]}
              />
              {Platform.OS === 'ios' ? (
                <>
                  <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('alarmModeLabel')}</Text>
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
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>
                    {!alarmsAvailable()
                      ? t('alarmModeUnavailable')
                      : alarmAuth === 'denied'
                        ? t('alarmModeDenied')
                        : t('alarmModeHint')}
                  </Text>
                  {alarmAuth === 'denied' ? (
                    <Button
                      kind="secondary"
                      label={t('openSystemSettings')}
                      icon={<Ionicons name="open-outline" size={16} color={c.textPrimary} />}
                      onPress={() => void Linking.openSettings()}
                    />
                  ) : null}
                </>
              ) : null}
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('voiceReminderLabel')}</Text>
              <AnimatedSegmentedControl
                value={prefs.data?.voice === false ? 'off' : 'on'}
                onChange={(next) => void prefs.setVoice(next === 'on')}
                options={[
                  { value: 'on', label: t('voiceReminderOn') },
                  { value: 'off', label: t('voiceReminderOff') },
                ]}
              />
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('voiceReminderHint')}</Text>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('reminderPrivacyLabel')}</Text>
              <AnimatedSegmentedControl
                value={prefs.data?.hideNamesInReminders ? 'hide' : 'show'}
                onChange={(next) => void prefs.setHideNames(next === 'hide')}
                options={[
                  { value: 'show', label: t('reminderPrivacyShow') },
                  { value: 'hide', label: t('reminderPrivacyHide') },
                ]}
              />
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('graceWindowLabel')}</Text>
              <AnimatedSegmentedControl
                value={(prefs.data?.graceHours ?? 4).toString()}
                onChange={(next) => void prefs.setGraceHours(Number.parseInt(next, 10) as GraceHours)}
                options={GRACE_OPTIONS.map((hours) => ({
                  value: hours.toString(),
                  label: t('graceWindowHours').replace('{hours}', hours.toString()),
                }))}
              />
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('followUpLabel')}</Text>
              <AnimatedSegmentedControl
                value={String(prefs.data?.followUpMinutes ?? 30)}
                onChange={(next) => void prefs.setFollowUpMinutes(Number.parseInt(next, 10) as FollowUpMinutes)}
                options={FOLLOW_UP_OPTIONS.map((minutes) => ({
                  value: String(minutes),
                  label: minutes === 0 ? t('followUpOff') : t('followUpMinutes').replace('{minutes}', String(minutes)),
                }))}
              />
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('followUpHint')}</Text>
            </View>
          </Card>
          {prefs.saveError ? <ErrorState description={t('saveReminderPrefError')} /> : null}
        </View>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  cardBody: { padding: spacing(4), gap: spacing(3) },
  permissionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
});
