import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  Button,
  Card,
  ListGroup,
  ListRow,
  PageHeader,
  PageShell,
  SectionHeader,
  Stack,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import {
  getDeliveryReliability,
  readReminderMetrics,
  useExactAlarmPermission,
  useReminderDiagnostics,
} from '@/lib/takt/reminders';
import { useLocale } from '@/lib/takt/l10n';

export default function ReminderTestScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const diagnostics = useReminderDiagnostics(50);
  const exactAlarm = useExactAlarmPermission();

  const [permissionStatus, setPermissionStatus] = useState<string>('Checking…');
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const [lastReconcile, setLastReconcile] = useState<string>('Never');
  const [testScheduled, setTestScheduled] = useState<boolean>(false);
  const [overnightScheduled, setOvernightScheduled] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<{
    scheduled: number;
    delivered: number;
    missed: number;
    reliability: number;
  }>({
    scheduled: 0,
    delivered: 0,
    missed: 0,
    reliability: 100,
  });

  const checkPermissionStatus = useCallback(async () => {
    const status = await Notifications.getPermissionsAsync();
    if (status.granted) {
      setPermissionStatus('Granted');
      return;
    }

    if (status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      setPermissionStatus('Provisional');
      return;
    }

    setPermissionStatus('Denied');
  }, []);

  const checkScheduledCount = useCallback(async () => {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    setScheduledCount(notifications.length);
  }, []);

  const loadMetrics = useCallback(async () => {
    const snapshot = await readReminderMetrics();
    const reliability = await getDeliveryReliability();
    setMetrics({
      scheduled: snapshot.totalScheduled,
      delivered: snapshot.totalDelivered,
      missed: snapshot.totalMissed,
      reliability,
    });
  }, []);

  useEffect(() => {
    void checkPermissionStatus();
    void checkScheduledCount();
    void loadMetrics();
  }, [checkPermissionStatus, checkScheduledCount, loadMetrics]);

  useEffect(() => {
    const reconcileEvent = diagnostics.rows.find((e) => e.kind === 'schedule.reconcile.done');
    if (!reconcileEvent) {
      setLastReconcile('Never');
      return;
    }

    setLastReconcile(new Date(reconcileEvent.at).toLocaleString());
  }, [diagnostics.rows]);

  const scheduleTestReminder = async () => {
    try {
      const triggerDate = new Date(Date.now() + 2 * 60 * 1000);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test Reminder',
          body: 'This is a test reminder from Takt.',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });

      setTestScheduled(true);
      Alert.alert('Success', `Test reminder scheduled for ${triggerDate.toLocaleTimeString()}`);
      await checkScheduledCount();
      await loadMetrics();
    } catch {
      Alert.alert('Error', 'Failed to schedule test reminder');
    }
  };

  const scheduleOvernightTest = async () => {
    try {
      const triggerDate = new Date(Date.now() + 8 * 60 * 60 * 1000);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Overnight Test Reminder',
          body: 'Overnight reminder from Takt.',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });

      setOvernightScheduled(true);
      Alert.alert(
        'Overnight Test Scheduled',
        `Reminder set for ${triggerDate.toLocaleTimeString()}.

1. Close the app completely
2. Check in the morning
3. Confirm the reminder arrived`,
      );
      await checkScheduledCount();
      await loadMetrics();
    } catch {
      Alert.alert('Error', 'Failed to schedule overnight test');
    }
  };

  const clearAllReminders = () => {
    Alert.alert(t('reminderTestClearAll'), 'Are you sure you want to cancel all scheduled reminders?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: () => {
          void Notifications.cancelAllScheduledNotificationsAsync().then(async () => {
            await checkScheduledCount();
            Alert.alert('Success', 'All reminders cleared');
          });
        },
      },
    ]);
  };

  return (
    <PageShell>
      <PageHeader title={t('reminderTestTitle')} subtitle={t('reminderTestSubtitle')} />

      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.headline, { color: c.textPrimary }]}>{t('reminderTestPermissions')}</Text>
            <ListGroup>
              <ListRow isFirst title={t('reminderTestNotificationPermission')} value={permissionStatus} />
              <ListRow
                title={t('reminderTestExactAlarmPermission')}
                value={
                  exactAlarm.loading
                    ? t('statusLoading')
                    : exactAlarm.hasPermission
                      ? t('statusDone')
                      : t('statusBlocked')
                }
              />
            </ListGroup>
            {!exactAlarm.hasPermission && Platform.OS === 'android' ? (
              <Button
                label={t('reminderTestOpenExactAlarmSettings')}
                onPress={() => void exactAlarm.openSettings()}
                kind="secondary"
              />
            ) : null}
          </View>
        </Card>

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.headline, { color: c.textPrimary }]}>{t('reminderTestScheduleStatus')}</Text>
            <ListGroup>
              <ListRow isFirst title={t('reminderTestScheduledCount')} value={scheduledCount.toString()} />
              <ListRow title={t('reminderTestLastReconcile')} value={lastReconcile} />
            </ListGroup>
          </View>
        </Card>

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.headline, { color: c.textPrimary }]}>{t('reminderTestMetrics')}</Text>
            <ListGroup>
              <ListRow isFirst title={t('reminderTestMetricsScheduled')} value={metrics.scheduled.toString()} />
              <ListRow title={t('reminderTestMetricsDelivered')} value={metrics.delivered.toString()} />
              <ListRow title={t('reminderTestMetricsMissed')} value={metrics.missed.toString()} />
              <ListRow title={t('reminderTestMetricsReliability')} value={`${metrics.reliability.toString()}%`} />
            </ListGroup>
          </View>
        </Card>

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.headline, { color: c.textPrimary }]}>{t('reminderTestActions')}</Text>
            <Button
              label={testScheduled ? t('reminderTestScheduled') : t('reminderTestScheduleTest')}
              onPress={() => void scheduleTestReminder()}
              disabled={testScheduled}
            />
            <Button
              label={overnightScheduled ? t('reminderTestOvernightScheduled') : t('reminderTestScheduleOvernight')}
              onPress={() => void scheduleOvernightTest()}
              disabled={overnightScheduled}
              kind="secondary"
            />
            <Button label={t('reminderTestClearAll')} onPress={clearAllReminders} kind="destructive" />
          </View>
        </Card>

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.headline, { color: c.textPrimary }]}>{t('reminderTestOvernightTitle')}</Text>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('reminderTestOvernightInstructions')}</Text>
            <ListGroup>
              <ListRow isFirst title={t('reminderTestOvernightStep1')} value="1" />
              <ListRow title={t('reminderTestOvernightStep2')} value="2" />
              <ListRow title={t('reminderTestOvernightStep3')} value="3" />
            </ListGroup>
          </View>
        </Card>

        <View>
          <SectionHeader title={t('reminderTestDiagnosticEvents')} />
          {diagnostics.loading ? (
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('reminderTestLoading')}</Text>
          ) : diagnostics.rows.length === 0 ? (
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('reminderTestNoEvents')}</Text>
          ) : (
            <ListGroup>
              {diagnostics.rows.map((event, index) => (
                <ListRow
                  key={event.id}
                  isFirst={index === 0}
                  title={event.kind}
                  subtitle={`${new Date(event.at).toLocaleString()}${event.detail ? ` - ${event.detail}` : ''}`}
                />
              ))}
            </ListGroup>
          )}
        </View>
      </Stack>
    </PageShell>
  );
}
