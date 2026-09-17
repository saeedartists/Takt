import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedDoseRow,
  AnimatedSegmentedControl,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FloatingUndoToast,
  GreetingHeroCard,
  PageHeader,
  PageShell,
  SectionHeader,
  SkeletonCard,
  SkeletonRow,
  Stack,
  WeekStripPicker,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { NextDoseCard, type NextDosePending } from '@/components/ui/next-dose-card';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useRecordDose, useUndoDose } from '@/lib/hooks/use-takt-mutations';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { adherenceSummary, buildDoseOccurrencesForDay, upcomingCount } from '@/lib/takt/schedule';
import { useLocale } from '@/lib/takt/l10n';
import { reminderDoseKey, scheduleSnoozeReminder } from '@/lib/takt/reminders';
import { addDays, isoDateKey, startOfDay } from '@/lib/takt/time';
import type { DoseOccurrence, DoseState } from '@/lib/takt/types';

const SNOOZE_OPTIONS = [5, 10, 15, 30];

const canUndo = (dose: DoseOccurrence): boolean => {
  if (!dose.eventId || !dose.eventTimestamp) return false;
  // Optimistic entries have no server id yet; the toast's Undo covers that window.
  if (dose.eventId.startsWith('optimistic-')) return false;
  if (!['taken', 'skipped'].includes(dose.state)) return false;
  const ageMs = Date.now() - new Date(dose.eventTimestamp).getTime();
  return ageMs <= 10 * 60 * 1000;
};

const getTimeIcon = (hour: number, c: ReturnType<typeof useTokens>['c']) => {
  if (hour < 12) return { name: 'sunny-outline' as const, color: c.warning };
  if (hour < 18) return { name: 'partly-sunny-outline' as const, color: c.accent };
  return { name: 'moon-outline' as const, color: c.textSecondary };
};

export default function TodayScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t, formatDate, formatTime } = useLocale();
  const { enter, duration } = useMotion();

  const params = useLocalSearchParams<{ focus?: string }>();
  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;

  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const recordDose = useRecordDose();
  const undoDose = useUndoDose();
  const reminderPrefs = useReminderPreferences();
  const defaultSnoozeMinutes = reminderPrefs.data?.snoozeMinutes ?? 15;
  const autoMarkedMissed = useRef<Set<string>>(new Set());
  const firstLoadDone = useRef(false);
  const [autoMissedCount, setAutoMissedCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nextPending, setNextPending] = useState<NextDosePending>(null);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'due' | 'pending' | 'completed'>('all');
  const [undoToast, setUndoToast] = useState<{
    visible: boolean;
    message: string;
    eventId?: string;
  } | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const isSelectedToday = isoDateKey(selectedDate) === isoDateKey(new Date());

  const eventResources = useMemo(
    () => (events.data?.entry ?? []).map((x) => x.resource),
    [events.data?.entry],
  );

  const selectedDoses = useMemo(
    () => buildDoseOccurrencesForDay(plans.plans, eventResources, startOfDay(selectedDate), new Date()),
    [eventResources, plans.plans, selectedDate],
  );

  // The next-dose card is always about today, whichever day the strip shows.
  const todayDoses = useMemo(
    () =>
      isSelectedToday
        ? selectedDoses
        : buildDoseOccurrencesForDay(plans.plans, eventResources, startOfDay(new Date()), new Date()),
    [eventResources, isSelectedToday, plans.plans, selectedDoses],
  );

  const adherenceMap = useMemo(() => {
    const map: Record<string, { total: number; taken: number; missed: number }> = {};
    const now = new Date();
    for (let offset = -7; offset <= 7; offset++) {
      const d = addDays(selectedDate, offset);
      const doses = buildDoseOccurrencesForDay(plans.plans, eventResources, startOfDay(d), now);
      const taken = doses.filter((x) => x.state === 'taken').length;
      const missed = doses.filter((x) => x.state === 'missed').length;
      map[isoDateKey(d)] = { total: doses.length, taken, missed };
    }
    return map;
  }, [eventResources, plans.plans, selectedDate]);

  const summary = adherenceSummary(selectedDoses);
  const toCome = upcomingCount(selectedDoses);
  const dueNow = selectedDoses.filter((dose) => dose.state === 'due').length;

  const completionPct =
    selectedDoses.length > 0
      ? Math.round((selectedDoses.filter((dose) => dose.state === 'taken').length / selectedDoses.length) * 100)
      : 0;

  const needsFirstMedication = plans.plans.length === 0;
  const needsFirstDoseLog = !needsFirstMedication && eventResources.length === 0;

  const filteredTimelineDoses = useMemo(() => {
    if (timelineFilter === 'all') return selectedDoses;
    if (timelineFilter === 'due') return selectedDoses.filter((dose) => dose.state === 'due');
    if (timelineFilter === 'pending')
      return selectedDoses.filter((dose) => dose.state === 'scheduled' || dose.state === 'due');
    return selectedDoses.filter(
      (dose) => dose.state === 'taken' || dose.state === 'skipped' || dose.state === 'missed',
    );
  }, [selectedDoses, timelineFilter]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, DoseOccurrence[]>();
    for (const dose of filteredTimelineDoses) {
      const key = formatTime(dose.scheduledAt);
      const list = buckets.get(key) ?? [];
      list.push(dose);
      buckets.set(key, list);
    }
    return [...buckets.entries()].map(([time, doses]) => ({ time, doses }));
  }, [filteredTimelineDoses, formatTime]);

  const isFirstLoad = patient.isLoading || plans.isLoading || events.isLoading;
  const loadError = patient.error || plans.error || events.error;

  useEffect(() => {
    if (!isFirstLoad) firstLoadDone.current = true;
  }, [isFirstLoad]);

  useEffect(() => {
    if (!patientRef || !isSelectedToday) return;

    const missedToPersist = selectedDoses.filter(
      (dose) => dose.state === 'missed' && !dose.eventId && !autoMarkedMissed.current.has(dose.id),
    );

    if (missedToPersist.length === 0) return;

    void (async () => {
      for (const dose of missedToPersist) {
        autoMarkedMissed.current.add(dose.id);
        try {
          await recordDose.mutateAsync({
            patientRef,
            medicationRef: dose.medicationRef,
            requestRef: `MedicationRequest/${dose.requestId}`,
            scheduledAt: dose.scheduledAt,
            action: 'missed',
          });
          setAutoMissedCount((n) => n + 1);
        } catch {
          autoMarkedMissed.current.delete(dose.id);
        }
      }
    })();
  }, [isSelectedToday, patientRef, recordDose, selectedDoses]);

  const takeAction = async (dose: DoseOccurrence, action: 'taken' | 'skipped') => {
    if (!patientRef) return;
    setActionError(null);

    try {
      const result = await recordDose.mutateAsync({
        patientRef,
        medicationRef: dose.medicationRef,
        requestRef: `MedicationRequest/${dose.requestId}`,
        scheduledAt: dose.scheduledAt,
        action,
      });

      setUndoToast({
        visible: true,
        message:
          action === 'taken'
            ? `${dose.label} · ${t('doseConfirmedToast')}`
            : `${dose.label} · ${t('doseSkippedToast')}`,
        eventId: result.id,
      });
    } catch {
      setActionError(t('doseActionError'));
    }
  };

  const handleUndoToast = async () => {
    if (!undoToast?.eventId) return;
    const eventId = undoToast.eventId;
    setUndoToast(null);

    try {
      await undoDose.mutateAsync(eventId);
    } catch {
      setActionError(t('undoDoseError'));
    }
  };

  const snoozeDose = async (dose: DoseOccurrence, minutes: number) => {
    setActionError(null);

    try {
      const result = await scheduleSnoozeReminder(
        {
          label: dose.label,
          delayMinutes: minutes,
          doseKey: reminderDoseKey(dose.requestId, dose.scheduledAt),
        },
        {
          title: t('doseSnoozedTitle'),
          body: t('doseSnoozedBody'),
        },
      );

      if (!result.scheduled) {
        setActionError(t('snoozeSingleLimit'));
      }
    } catch {
      setActionError(t('snoozeError'));
    }
  };

  const runNextAction = async (kind: Exclude<NextDosePending, null>, dose: DoseOccurrence) => {
    setNextPending(kind);
    try {
      if (kind === 'snooze') await snoozeDose(dose, defaultSnoozeMinutes);
      else await takeAction(dose, kind === 'take' ? 'taken' : 'skipped');
    } finally {
      setNextPending(null);
    }
  };

  const stateLabel = (state: DoseState): string => {
    if (state === 'due') return t('statusDue');
    if (state === 'taken') return t('statusTaken');
    if (state === 'skipped') return t('statusSkipped');
    if (state === 'missed') return t('statusMissed');
    return t('statusScheduled');
  };

  const refetchAll = () => {
    void patient.refetch();
    void plans.requestsQuery.refetch();
    void plans.medicationsQuery.refetch();
    void events.refetch();
  };

  const patientFirstName = patient.data?.name?.[0]?.given?.[0];
  let rowIndex = 0;

  return (
    <View style={{ flex: 1 }}>
      <PageShell>
        <PageHeader
          title={t('today')}
          subtitle={formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}
          action={
            <Link href="/report" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('openReport')}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minHeight: 44, justifyContent: 'center' })}
              >
                <Text style={[typography.subhead, { color: c.accent, fontWeight: '600' }]}>{t('report')}</Text>
              </Pressable>
            </Link>
          }
        />

        <Stack>
          {isFirstLoad ? (
            <>
              <SkeletonCard rows={1} />
              <Card>
                <SkeletonRow isFirst />
                <SkeletonRow />
                <SkeletonRow />
              </Card>
            </>
          ) : loadError ? (
            <ErrorState description={t('loadScheduleError')} onRetry={refetchAll} />
          ) : (
            <>
              <NextDoseCard
                doses={todayDoses}
                hasPlans={!needsFirstMedication}
                showFirstDoseHint={needsFirstDoseLog}
                pending={nextPending}
                snoozeMinutes={defaultSnoozeMinutes}
                stateLabel={stateLabel}
                onTake={(dose) => void runNextAction('take', dose)}
                onSkip={(dose) => void runNextAction('skip', dose)}
                onSnooze={(dose) => void runNextAction('snooze', dose)}
                onAddMedication={() => router.push('/medications/new')}
              />

              <GreetingHeroCard
                patientName={patientFirstName}
                takenCount={summary.taken}
                totalCount={selectedDoses.length}
                dueNowCount={dueNow}
                upcomingCount={toCome}
                completionPct={completionPct}
                labels={{
                  greetingMorning: t('greetingMorning'),
                  greetingAfternoon: t('greetingAfternoon'),
                  greetingEvening: t('greetingEvening'),
                  takenToday: t('takenToday'),
                  dueNow: t('dueNow'),
                  toCome: t('toCome'),
                }}
              />

              <WeekStripPicker
                selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
                adherenceMap={adherenceMap}
                todayLabel={t('today')}
              />

              {autoMissedCount > 0 ? (
                <Card>
                  <View style={styles.noticeRow}>
                    <Ionicons name="information-circle-outline" size={18} color={c.textSecondary} />
                    <Text style={[typography.footnote, { color: c.textSecondary, flex: 1, minWidth: 0 }]}>
                      {autoMissedCount === 1
                        ? t('autoMissedNoticeOne')
                        : t('autoMissedNoticeMany').replace('{count}', String(autoMissedCount))}
                    </Text>
                    <Link href="/(tabs)/history" asChild>
                      <Pressable accessibilityRole="link" accessibilityLabel={t('fixInHistory')} hitSlop={8}>
                        <Text style={[typography.footnote, { color: c.accent, fontWeight: '600' }]}>
                          {t('fixInHistory')}
                        </Text>
                      </Pressable>
                    </Link>
                  </View>
                </Card>
              ) : null}

              {actionError ? (
                <Text
                  accessibilityRole="alert"
                  style={[typography.footnote, { color: c.destructive, paddingHorizontal: spacing(1) }]}
                >
                  {actionError}
                </Text>
              ) : null}

              <View>
                <SectionHeader
                  title={t('timeline')}
                  action={
                    <Button
                      kind="secondary"
                      size="sm"
                      label={t('addMedication')}
                      icon={<Ionicons name="add" size={16} color={c.textPrimary} />}
                      onPress={() => router.push('/medications/new')}
                    />
                  }
                />
                <Card style={{ marginBottom: spacing(3) }}>
                  <View style={{ padding: spacing(2.5) }}>
                    <AnimatedSegmentedControl
                      value={timelineFilter}
                      onChange={(next) => setTimelineFilter(next as 'all' | 'due' | 'pending' | 'completed')}
                      options={[
                        { value: 'all', label: t('todayFilterAll') },
                        { value: 'due', label: t('todayFilterDue') },
                        { value: 'pending', label: t('todayFilterPending') },
                        { value: 'completed', label: t('todayFilterCompleted') },
                      ]}
                    />
                  </View>
                </Card>

                {grouped.length === 0 ? (
                  <EmptyState
                    title={timelineFilter === 'all' ? t('noDosesToday') : t('noDosesForFilter')}
                    description={t('addMedicationHint')}
                    action={<Button label={t('addMedication')} onPress={() => router.push('/medications/new')} />}
                  />
                ) : (
                  // Filter change: crossfade the whole group container; rows only stagger on first load.
                  <Animated.View key={timelineFilter} entering={FadeIn.duration(duration.fast)} style={styles.groups}>
                    {grouped.map((bucket) => {
                      const timeIcon = getTimeIcon(bucket.doses[0]?.scheduledAt.getHours() ?? 12, c);
                      const doseCountText = `${bucket.doses.length} ${
                        bucket.doses.length === 1 ? t('singleDoseLabel') : t('multipleDosesLabel')
                      }`;

                      return (
                        <Animated.View key={bucket.time} layout={LinearTransition}>
                          <Card>
                            <View style={{ overflow: 'hidden', borderRadius: radius.xl }}>
                              <View style={styles.timeHeader}>
                                <View style={styles.timeHeaderLeft}>
                                  <View style={[styles.timeIconBadge, { backgroundColor: `${timeIcon.color}18` }]}>
                                    <Ionicons name={timeIcon.name} size={15} color={timeIcon.color} />
                                  </View>
                                  <Text
                                    style={[typography.headline, { color: c.textPrimary, fontVariant: ['tabular-nums'] }]}
                                  >
                                    {bucket.time}
                                  </Text>
                                </View>
                                <View style={[styles.doseCountPill, { backgroundColor: c.surfaceSubtle }]}>
                                  <Text style={[typography.caption, { color: c.textSecondary, fontWeight: '600' }]}>
                                    {doseCountText}
                                  </Text>
                                </View>
                              </View>
                              {bucket.doses.map((dose, index) => {
                                const isFocused =
                                  typeof params.focus === 'string' &&
                                  params.focus === reminderDoseKey(dose.requestId, dose.scheduledAt);
                                const entering = firstLoadDone.current ? undefined : enter(rowIndex++);

                                return (
                                  <Animated.View key={dose.id} entering={entering} layout={LinearTransition}>
                                    <AnimatedDoseRow
                                      dose={dose}
                                      isFirst={index === 0}
                                      isFocused={isFocused}
                                      canUndo={canUndo(dose)}
                                      stateLabel={stateLabel(dose.state)}
                                      onTake={() => takeAction(dose, 'taken')}
                                      onSkip={() => takeAction(dose, 'skipped')}
                                      onSnooze={(minutes) => snoozeDose(dose, minutes)}
                                      onUndo={async () => {
                                        try {
                                          await undoDose.mutateAsync(dose.eventId!);
                                        } catch {
                                          setActionError(t('undoDoseError'));
                                        }
                                      }}
                                      busy={nextPending !== null}
                                      snoozeOptions={SNOOZE_OPTIONS}
                                      defaultSnoozeMinutes={defaultSnoozeMinutes}
                                      labels={{
                                        time: bucket.time,
                                        confirmTaken: t('confirmTaken'),
                                        markSkipped: t('markSkipped'),
                                        snooze: t('snooze'),
                                        snoozeRemindIn: t('snoozeRemindIn'),
                                        cancel: t('cancel'),
                                        undo: t('undo'),
                                        contextBadge: t('reminderContextBadge'),
                                      }}
                                    />
                                  </Animated.View>
                                );
                              })}
                            </View>
                          </Card>
                        </Animated.View>
                      );
                    })}
                  </Animated.View>
                )}
              </View>
            </>
          )}
        </Stack>
      </PageShell>

      <FloatingUndoToast
        visible={Boolean(undoToast?.visible)}
        message={undoToast?.message ?? ''}
        undoLabel={t('undoAction')}
        onUndo={() => void handleUndoToast()}
        onDismiss={() => setUndoToast(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing(3) },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  timeHeader: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3.5),
    paddingBottom: spacing(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
  },
  timeIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doseCountPill: {
    paddingHorizontal: spacing(2.5),
    paddingVertical: 3,
    borderRadius: radius.full,
  },
});
