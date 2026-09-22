import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useCallback, useState } from 'react';
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
import { GRACE_OPTIONS, useReminderPreferences, type GraceHours } from '@/lib/takt/preferences';
import { readReminderPermissionStatus } from '@/lib/takt/reminders';

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

  const sendTest = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('testReminderTitle'),
          body: t('testReminderBody'),
          sound: prefs.data?.sound === false ? false : 'default',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
      });
      setTest('sent');
    } catch {
      setTest('error');
    }
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
