import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedDoseRow,
  AnimatedSegmentedControl,
  Badge,
  Button,
  Card,
  CelebrationCard,
  EmptyState,
  ErrorState,
  FloatingUndoToast,
  GreetingHeroCard,
  LoadingState,
  PageHeader,
  PageShell,
  SectionHeader,
  Stack,
  WeekStripPicker,
  radius,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
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

const canUndo = (dose: DoseOccurrence): boolean => {
  if (!dose.eventId || !dose.eventTimestamp) return false;
  if (!['taken', 'skipped'].includes(dose.state)) return false;
  const ageMs = Date.now() - new Date(dose.eventTimestamp).getTime();
  return ageMs <= 10 * 60 * 1000;
};

const getTimeIcon = (timeStr: string) => {
  const hour = parseInt(timeStr.split(':')[0] ?? '12', 10);
  if (hour < 12) return { name: 'sunny-outline' as const, color: '#F59E0B' };
  if (hour < 18) return { name: 'partly-sunny-outline' as const, color: '#3B82F6' };
  return { name: 'moon-outline' as const, color: '#8B5CF6' };
};

export default function TodayScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t, formatDate, formatTime } = useLocale();

  const params = useLocalSearchParams<{ focus?: string }>();
  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;

  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const recordDose = useRecordDose();
  const undoDose = useUndoDose();
  const reminderPrefs = useReminderPreferences();
  const autoMarkedMissed = useRef<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'due' | 'pending' | 'completed'>('all');
  const [undoToast, setUndoToast] = useState<{
    visible: boolean;
    message: string;
    eventId?: string;
  } | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const isSelectedToday = isoDateKey(selectedDate) === isoDateKey(new Date());

  const selectedDoses = useMemo(
    () =>
      buildDoseOccurrencesForDay(
        plans.plans,
        (events.data?.entry ?? []).map((x) => x.resource),
        startOfDay(selectedDate),
        new Date(),
      ),
    [events.data?.entry, plans.plans, selectedDate],
  );

  const adherenceMap = useMemo(() => {
    const map: Record<string, { total: number; taken: number; missed: number }> = {};
    const bundle = (events.data?.entry ?? []).map((x) => x.resource);
    const now = new Date();
    for (let offset = -7; offset <= 7; offset++) {
      const d = addDays(selectedDate, offset);
      const dayStart = startOfDay(d);
      const doses = buildDoseOccurrencesForDay(plans.plans, bundle, dayStart, now);
      const taken = doses.filter((x) => x.state === 'taken').length;
      const missed = doses.filter((x) => x.state === 'missed').length;
      map[isoDateKey(d)] = { total: doses.length, taken, missed };
    }
    return map;
  }, [events.data?.entry, plans.plans, selectedDate]);

  const summary = adherenceSummary(selectedDoses);
  const toCome = upcomingCount(selectedDoses);
  const dueNow = selectedDoses.filter((dose) => dose.state === 'due').length;

  const completionPct =
    selectedDoses.length > 0
      ? Math.round((selectedDoses.filter((dose) => dose.state === 'taken').length / selectedDoses.length) * 100)
      : 0;

  const loggedDoseCount = (events.data?.entry ?? []).length;
  const needsFirstMedication = plans.plans.length === 0;
  const needsFirstDoseLog = !needsFirstMedication && loggedDoseCount === 0;

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

  const snoozeDose = async (dose: DoseOccurrence) => {
    setActionError(null);

    try {
      const result = await scheduleSnoozeReminder(
        {
          label: dose.label,
          delayMinutes: reminderPrefs.data?.snoozeMinutes ?? 15,
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

  const stateLabel = (state: DoseState): string => {
    if (state === 'due') return t('statusDue');
    if (state === 'taken') return t('statusTaken');
    if (state === 'skipped') return t('statusSkipped');
    if (state === 'missed') return t('statusMissed');
    return t('statusScheduled');
  };

  const patientFirstName = patient.data?.name?.[0]?.given?.[0];

  return (
    <View style={{ flex: 1 }}>
      <PageShell>
        <PageHeader
          title={t('today')}
          subtitle={formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}
          action={
            <Link href="/report" asChild>
              <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Text style={[typography.subhead, { color: c.accent, fontWeight: '600' }]}>
                  {t('report')}
                </Text>
              </Pressable>
            </Link>
          }
        />

        <Stack>
          <WeekStripPicker
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d)}
            adherenceMap={adherenceMap}
            todayLabel={t('today')}
          />

          {needsFirstMedication || needsFirstDoseLog ? (
            <Card>
              <View style={{ padding: spacing(4), gap: spacing(3) }}>
                <Badge
                  label={
                    needsFirstMedication
                      ? t('journeyStepOneLabel')
                      : needsFirstDoseLog
                        ? t('journeyStepTwoLabel')
                        : t('journeyCompleteLabel')
                  }
                  tone="accent"
                />
                <Text style={[typography.headline, { color: c.textPrimary }]}>
                  {t('journeyCardTitle')}
                </Text>
                <Text style={[typography.subhead, { color: c.textSecondary }]}>
                  {needsFirstMedication ? t('journeyCardNeedMedication') : t('journeyCardNeedDose')}
                </Text>
                <Button
                  label={needsFirstMedication ? t('journeyAddMedicationCta') : t('journeyLogDoseCta')}
                  onPress={() => {
                    if (needsFirstMedication) {
                      router.push('/medications/new');
                      return;
                    }
                    router.push('/(tabs)/today');
                  }}
                  disabled={recordDose.isPending || patient.isLoading}
                />
              </View>
            </Card>
          ) : null}

          <GreetingHeroCard
            patientName={patientFirstName}
            dateLabel={formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
            takenCount={summary.taken}
            totalCount={selectedDoses.length}
            dueNowCount={dueNow}
            upcomingCount={toCome}
            completionPct={completionPct}
            labels={{
              greetingMorning: t('greetingMorning'),
              greetingAfternoon: t('greetingAfternoon'),
              greetingEvening: t('greetingEvening'),
              rhythmToday: t('rhythmToday'),
              takenToday: t('takenToday'),
              completion: t('completion'),
              allDoneToday: t('allDoneToday'),
              dueNow: t('dueNow'),
              toCome: t('toCome'),
              logged: t('logged'),
            }}
          />

          {selectedDoses.length > 0 && completionPct === 100 ? (
            <CelebrationCard count={selectedDoses.length} />
          ) : null}

          {actionError ? (
            <Text style={[typography.footnote, { color: c.destructive, paddingHorizontal: spacing(1) }]}>
              {actionError}
            </Text>
          ) : null}

          <View>
            <SectionHeader
              title={t('timeline')}
              action={
                <Button
                  kind="secondary"
                  label={t('addMedication')}
                  onPress={() => router.push('/medications/new')}
                />
              }
            />
            <Card style={{ marginBottom: spacing(3) }}>
              <View style={{ padding: spacing(2.5) }}>
                <AnimatedSegmentedControl
                  value={timelineFilter}
                  onChange={(next) =>
                    setTimelineFilter(next as 'all' | 'due' | 'pending' | 'completed')
                  }
                  options={[
                    { value: 'all', label: t('todayFilterAll') },
                    { value: 'due', label: t('todayFilterDue') },
                    { value: 'pending', label: t('todayFilterPending') },
                    { value: 'completed', label: t('todayFilterCompleted') },
                  ]}
                />
              </View>
            </Card>

            {patient.isLoading || plans.isLoading || events.isLoading ? (
              <LoadingState label={t('loadingDoses')} />
            ) : patient.error || plans.error || events.error ? (
              <ErrorState
                description={t('loadScheduleError')}
                onRetry={() => {
                  void patient.refetch();
                  void plans.requestsQuery.refetch();
                  void plans.medicationsQuery.refetch();
                  void events.refetch();
                }}
              />
            ) : grouped.length === 0 ? (
              <EmptyState
                title={timelineFilter === 'all' ? t('noDosesToday') : t('noDosesForFilter')}
                description={t('addMedicationHint')}
                action={<Button label={t('addMedication')} onPress={() => router.push('/medications/new')} />}
              />
            ) : (
              <Stack>
                {grouped.map((bucket) => {
                  const timeIcon = getTimeIcon(bucket.time);
                  const doseCountText = `${bucket.doses.length} ${
                    bucket.doses.length === 1 ? t('singleDoseLabel') : t('multipleDosesLabel')
                  }`;

                  return (
                    <Card key={bucket.time}>
                      <View style={{ overflow: 'hidden', borderRadius: radius.lg }}>
                        <View style={styles.timeHeader}>
                          <View style={styles.timeHeaderLeft}>
                            <View style={[styles.timeIconBadge, { backgroundColor: `${timeIcon.color}18` }]}>
                              <Ionicons name={timeIcon.name} size={15} color={timeIcon.color} />
                            </View>
                            <Text style={[typography.headline, { color: c.textPrimary }]}>{bucket.time}</Text>
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

                          return (
                            <AnimatedDoseRow
                              key={dose.id}
                              dose={dose}
                              isFirst={index === 0}
                              isFocused={isFocused}
                              canUndo={canUndo(dose)}
                              stateLabel={stateLabel(dose.state)}
                              onTake={() => takeAction(dose, 'taken')}
                              onSkip={() => takeAction(dose, 'skipped')}
                              onSnooze={() => snoozeDose(dose)}
                              onUndo={async () => {
                                try {
                                  await undoDose.mutateAsync(dose.eventId!);
                                } catch {
                                  setActionError(t('undoDoseError'));
                                }
                              }}
                              busy={recordDose.isPending || undoDose.isPending}
                              labels={{
                                confirmTaken: t('confirmTaken'),
                                markSkipped: t('markSkipped'),
                                snooze: `${t('snooze')} ${reminderPrefs.data?.snoozeMinutes ?? 15}m`,
                                undo: t('undo'),
                                contextBadge: t('reminderContextBadge'),
                              }}
                            />
                          );
                        })}
                      </View>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </View>
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
