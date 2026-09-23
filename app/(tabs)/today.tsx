import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedDoseRow,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FloatingUndoToast,
  PageHeader,
  PageShell,
  SectionHeader,
  SkeletonCard,
  SkeletonRow,
  Stack,
  TodayHeroCard,
  WeekStripPicker,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
  type HeroPending,
} from '@/components/ui';
import { MedicationGlyph } from '@/components/takt/medication-glyph';
import { SharedWithMeCard } from '@/components/takt/shared-with-me-card';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useRecordDose, useUndoDose } from '@/lib/hooks/use-takt-mutations';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { describeInstruction } from '@/lib/takt/medication-form';
import { buildAsNeededLogForDay, buildDoseOccurrencesForDay } from '@/lib/takt/schedule';
import { useLocale } from '@/lib/takt/l10n';
import { reminderDoseKey, scheduleSnoozeReminder } from '@/lib/takt/reminders';
import { addDays, isoDateKey, startOfDay } from '@/lib/takt/time';
import type { DoseOccurrence, DoseState, MedicationPlan, SkipReason } from '@/lib/takt/types';

const SNOOZE_OPTIONS = [5, 10, 15, 30];

const isPersisted = (dose: DoseOccurrence): boolean =>
  Boolean(dose.eventId) && !dose.eventId!.startsWith('optimistic-');

const canUndo = (dose: DoseOccurrence): boolean => {
  if (!dose.eventTimestamp || !isPersisted(dose)) return false;
  if (!['taken', 'skipped'].includes(dose.state)) return false;
  const ageMs = Date.now() - new Date(dose.eventTimestamp).getTime();
  return ageMs <= 10 * 60 * 1000;
};

const isActionable = (dose: DoseOccurrence): boolean => dose.state === 'due' || dose.state === 'missed';

const getTimeIcon = (hour: number, c: ReturnType<typeof useTokens>['c']) => {
  if (hour < 12) return { name: 'sunny-outline' as const, color: c.warning };
  if (hour < 18) return { name: 'partly-sunny-outline' as const, color: c.accent };
  return { name: 'moon-outline' as const, color: c.textSecondary };
};

export default function TodayScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t, formatDate, formatTime } = useLocale();
  const { enter } = useMotion();

  const params = useLocalSearchParams<{ focus?: string }>();
  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;

  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const recordDose = useRecordDose();
  const undoDose = useUndoDose();
  const reminderPrefs = useReminderPreferences();
  const defaultSnoozeMinutes = reminderPrefs.data?.snoozeMinutes ?? 15;
  const graceHours = reminderPrefs.data?.graceHours;
  const autoMarkedMissed = useRef<Set<string>>(new Set());
  const firstLoadDone = useRef(false);
  const [autoMissedCount, setAutoMissedCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [heroPending, setHeroPending] = useState<HeroPending>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [prnPending, setPrnPending] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<{
    visible: boolean;
    message: string;
    eventId?: string;
  } | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // Dose states depend on the clock: refresh when Today gains focus and once a minute while it is shown,
  // so a dose that becomes due (or missed) while the screen is open changes without a tap.
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const id = setInterval(() => setNow(new Date()), 60_000);
      return () => clearInterval(id);
    }, []),
  );
  const isSelectedToday = isoDateKey(selectedDate) === isoDateKey(now);

  const eventResources = useMemo(
    () => (events.data?.entry ?? []).map((x) => x.resource),
    [events.data?.entry],
  );

  const selectedDoses = useMemo(
    () => buildDoseOccurrencesForDay(plans.plans, eventResources, startOfDay(selectedDate), now, graceHours),
    [eventResources, graceHours, now, plans.plans, selectedDate],
  );

  // The hero is always about today, whichever day the strip shows.
  const todayDoses = useMemo(
    () =>
      isSelectedToday
        ? selectedDoses
        : buildDoseOccurrencesForDay(plans.plans, eventResources, startOfDay(now), now, graceHours),
    [eventResources, graceHours, isSelectedToday, now, plans.plans, selectedDoses],
  );

  const adherenceMap = useMemo(() => {
    const map: Record<string, { total: number; taken: number; missed: number }> = {};
    for (let offset = -7; offset <= 7; offset++) {
      const d = addDays(selectedDate, offset);
      const doses = buildDoseOccurrencesForDay(plans.plans, eventResources, startOfDay(d), now, graceHours);
      const taken = doses.filter((x) => x.state === 'taken').length;
      const missed = doses.filter((x) => x.state === 'missed').length;
      map[isoDateKey(d)] = { total: doses.length, taken, missed };
    }
    return map;
  }, [eventResources, graceHours, now, plans.plans, selectedDate]);

  // As-needed medications: never scheduled, logged when taken.
  const asNeededLog = useMemo(
    () => buildAsNeededLogForDay(plans.plans, eventResources, startOfDay(selectedDate)),
    [eventResources, plans.plans, selectedDate],
  );

  const needsFirstMedication = plans.plans.length === 0;
  const needsFirstDoseLog = !needsFirstMedication && eventResources.length === 0;

  const grouped = useMemo(() => {
    const buckets = new Map<string, DoseOccurrence[]>();
    for (const dose of selectedDoses) {
      const key = formatTime(dose.scheduledAt);
      const list = buckets.get(key) ?? [];
      list.push(dose);
      buckets.set(key, list);
    }
    return [...buckets.entries()].map(([time, doses]) => ({ time, doses }));
  }, [formatTime, selectedDoses]);

  const isFirstLoad = patient.isLoading || plans.isLoading || events.isLoading;
  const loadError = patient.error || plans.error || events.error;

  useEffect(() => {
    if (!isFirstLoad) firstLoadDone.current = true;
  }, [isFirstLoad]);

  const skipReasons = useMemo(
    () => [
      { code: 'forgot' as const, label: t('skipReasonForgot') },
      { code: 'side-effects' as const, label: t('skipReasonSideEffects') },
      { code: 'ran-out' as const, label: t('skipReasonRanOut') },
      { code: 'not-needed' as const, label: t('skipReasonNotNeeded') },
      { code: 'other' as const, label: t('skipReasonOther') },
    ],
    [t],
  );

  // VoiceOver / TalkBack: answer "what now, and did I already?" the moment Today is shown.
  const takenToday = todayDoses.filter((dose) => dose.state === 'taken').length;
  useFocusEffect(
    useCallback(() => {
      if (isFirstLoad || loadError) return;
      const next = todayDoses.find((dose) => dose.state === 'scheduled' || dose.state === 'due');
      const message = (next ? t('todaySummaryAnnouncement') : t('todaySummaryAnnouncementNoNext'))
        .replace('{taken}', String(takenToday))
        .replace('{total}', String(todayDoses.length))
        .replace('{time}', next ? formatTime(next.scheduledAt) : '');
      AccessibilityInfo.announceForAccessibility(message);
    }, [formatTime, isFirstLoad, loadError, t, takenToday, todayDoses]),
  );

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

  /** Records a taken/skipped event; a missed dose's auto-record is replaced, as History does. */
  const takeAction = async (dose: DoseOccurrence, action: 'taken' | 'skipped', reason?: SkipReason) => {
    if (!patientRef) return;
    setActionError(null);

    try {
      if (isPersisted(dose)) {
        await undoDose.mutateAsync(dose.eventId!);
      }

      const result = await recordDose.mutateAsync({
        patientRef,
        medicationRef: dose.medicationRef,
        requestRef: `MedicationRequest/${dose.requestId}`,
        scheduledAt: dose.scheduledAt,
        action,
        reason,
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

  /** An as-needed dose is recorded at the moment it is logged; Undo lives in the toast. */
  const logAsNeeded = async (plan: MedicationPlan) => {
    if (!patientRef) return;
    setActionError(null);
    setPrnPending(plan.request.id);
    try {
      const result = await recordDose.mutateAsync({
        patientRef,
        medicationRef: plan.request.medicationReference?.reference,
        requestRef: `MedicationRequest/${plan.request.id}`,
        scheduledAt: new Date(),
        action: 'taken',
      });
      setUndoToast({ visible: true, message: `${plan.label} · ${t('doseConfirmedToast')}`, eventId: result.id });
    } catch {
      setActionError(t('doseActionError'));
    } finally {
      setPrnPending(null);
    }
  };

  // One tap for a whole time group; each dose still gets its own record (brief §12).
  const confirmAll = async (doses: DoseOccurrence[]) => {
    setBulkPending(true);
    try {
      for (const dose of doses) await takeAction(dose, 'taken');
    } finally {
      setBulkPending(false);
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
          bodyPrivate: t('doseSnoozedBodyPrivate'),
        },
      );

      if (!result.scheduled) {
        setActionError(t('snoozeSingleLimit'));
      }
    } catch {
      setActionError(t('snoozeError'));
    }
  };

  const runHeroAction = async (kind: Exclude<HeroPending, null>, dose: DoseOccurrence, reason?: SkipReason) => {
    setHeroPending(kind);
    try {
      if (kind === 'snooze') await snoozeDose(dose, defaultSnoozeMinutes);
      else await takeAction(dose, kind === 'take' ? 'taken' : 'skipped', reason);
    } finally {
      setHeroPending(null);
    }
  };

  const stateLabel = (state: DoseState): string => {
    if (state === 'due') return t('statusDue');
    if (state === 'taken') return t('statusTaken');
    if (state === 'skipped') return t('statusSkipped');
    if (state === 'missed') return t('statusMissed');
    return t('statusScheduled');
  };

  /** "Taken at 08:05" on taken rows, "Skipped · Forgot" on skipped rows. */
  const doseDetail = (dose: DoseOccurrence): string | undefined => {
    if (dose.state === 'taken' && dose.eventTimestamp) {
      return `${t('takenAtLabel')} ${formatTime(new Date(dose.eventTimestamp))}`;
    }
    if (dose.state === 'skipped') {
      const reason = skipReasons.find((option) => option.code === dose.reasonCode);
      return reason ? `${t('statusSkipped')} · ${reason.label}` : undefined;
    }
    return undefined;
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
            <Button
              size="sm"
              kind="secondary"
              label={t('report')}
              icon={<Ionicons name="document-text-outline" size={16} color={c.textPrimary} />}
              accessibilityLabel={t('openReport')}
              onPress={() => router.push('/report')}
            />
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
              <TodayHeroCard
                patientName={patientFirstName}
                doses={todayDoses}
                hasPlans={!needsFirstMedication}
                showFirstDoseHint={needsFirstDoseLog}
                pending={heroPending}
                snoozeMinutes={defaultSnoozeMinutes}
                stateLabel={stateLabel}
                skipReasons={skipReasons}
                onTake={(dose) => void runHeroAction('take', dose)}
                onSkip={(dose, reason) => void runHeroAction('skip', dose, reason)}
                onSnooze={(dose) => void runHeroAction('snooze', dose)}
                onAddMedication={() => router.push('/medications/new')}
              />

              <WeekStripPicker
                selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
                adherenceMap={adherenceMap}
                todayLabel={t('today')}
              />

              {/* Auto-marked misses are fixable on the rows below, so the notice goes once none is left. */}
              {autoMissedCount > 0 && todayDoses.some((dose) => dose.state === 'missed') ? (
                <Card>
                  <View style={styles.noticeRow}>
                    <Ionicons name="information-circle-outline" size={18} color={c.textSecondary} />
                    <Text style={[typography.footnote, { color: c.textSecondary, flex: 1, minWidth: 0 }]}>
                      {autoMissedCount === 1
                        ? t('autoMissedNoticeOne')
                        : t('autoMissedNoticeMany').replace('{count}', String(autoMissedCount))}
                    </Text>
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
                  title={
                    isSelectedToday
                      ? t('timeline')
                      : formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })
                  }
                />

                {grouped.length === 0 ? (
                  <EmptyState
                    title={t('noDosesToday')}
                    description={needsFirstMedication ? t('addMedicationHint') : undefined}
                    action={
                      needsFirstMedication ? (
                        <Button label={t('addMedication')} onPress={() => router.push('/medications/new')} />
                      ) : undefined
                    }
                  />
                ) : (
                  <View style={styles.groups}>
                    {grouped.map((bucket) => {
                      const timeIcon = getTimeIcon(bucket.doses[0]?.scheduledAt.getHours() ?? 12, c);
                      const doseCountText = `${bucket.doses.length} ${
                        bucket.doses.length === 1 ? t('singleDoseLabel') : t('multipleDosesLabel')
                      }`;
                      const actionable = bucket.doses.filter(isActionable);

                      return (
                        <Animated.View key={bucket.time} layout={LinearTransition}>
                          <Card>
                            <View style={{ overflow: 'hidden', borderRadius: radius.xl }}>
                              <View style={styles.timeHeader}>
                                <View style={styles.timeHeaderLeft}>
                                  <Ionicons name={timeIcon.name} size={15} color={timeIcon.color} />
                                  <Text
                                    style={[typography.headline, { color: c.textPrimary, fontVariant: ['tabular-nums'] }]}
                                  >
                                    {bucket.time}
                                  </Text>
                                </View>
                                {actionable.length >= 2 ? (
                                  <Button
                                    size="sm"
                                    label={t('confirmAllAt').replace('{count}', String(actionable.length))}
                                    icon={<Ionicons name="checkmark-done" size={16} color={c.surface} />}
                                    loading={bulkPending}
                                    disabled={heroPending !== null}
                                    haptic="success"
                                    accessibilityLabel={`${t('confirmAllAt').replace('{count}', String(actionable.length))}, ${bucket.time}`}
                                    onPress={() => void confirmAll(actionable)}
                                  />
                                ) : (
                                  <Text style={[typography.footnote, { color: c.textTertiary }]}>{doseCountText}</Text>
                                )}
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
                                      instruction={describeInstruction(dose, t)}
                                      detail={doseDetail(dose)}
                                      onTake={() => takeAction(dose, 'taken')}
                                      onSkip={(reason) => takeAction(dose, 'skipped', reason)}
                                      skipReasons={skipReasons}
                                      onSnooze={(minutes) => snoozeDose(dose, minutes)}
                                      onUndo={async () => {
                                        try {
                                          await undoDose.mutateAsync(dose.eventId!);
                                        } catch {
                                          setActionError(t('undoDoseError'));
                                        }
                                      }}
                                      busy={heroPending !== null || bulkPending}
                                      snoozeOptions={SNOOZE_OPTIONS}
                                      defaultSnoozeMinutes={defaultSnoozeMinutes}
                                      labels={{
                                        time: bucket.time,
                                        confirmTaken: t('confirmTaken'),
                                        markTaken: t('markTakenFromHistory'),
                                        takeEarly: t('takeEarly'),
                                        markSkipped: t('markSkipped'),
                                        snooze: t('snooze'),
                                        snoozeRemindIn: t('snoozeRemindIn'),
                                        skipReasonPrompt: t('skipReasonPrompt'),
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
                  </View>
                )}
              </View>

              {asNeededLog.length > 0 ? (
                <View>
                  <SectionHeader title={t('cadenceAsNeeded')} />
                  <Card>
                    {asNeededLog.map((entry, index) => {
                      const last = entry.doses[entry.doses.length - 1];
                      const line = last
                        ? t('asNeededTakenToday')
                            .replace('{count}', String(entry.doses.length))
                            .replace('{time}', formatTime(last.scheduledAt))
                        : t('asNeededNoneToday');
                      return (
                        <View
                          key={entry.plan.request.id}
                          style={[styles.prnRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}
                        >
                          <MedicationGlyph appearance={entry.plan.appearance} form={entry.plan.form} />
                          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                            <Text numberOfLines={2} style={[typography.headline, { color: c.textPrimary }]}>
                              {entry.plan.label}
                            </Text>
                            <Text style={[typography.footnote, { color: c.textSecondary }]}>
                              {[
                                entry.plan.strength,
                                entry.plan.maxPerDay ? t('asNeededUpTo').replace('{count}', String(entry.plan.maxPerDay)) : undefined,
                                describeInstruction(entry.plan, t),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                            <Text style={[typography.footnote, { color: last ? c.success : c.textSecondary, fontWeight: '600' }]}>
                              {entry.atMax ? t('asNeededMaxReached') : line}
                            </Text>
                          </View>
                          <Button
                            size="sm"
                            label={t('logDoseCta')}
                            icon={<Ionicons name="add" size={16} color={c.surface} />}
                            disabled={entry.atMax || !isSelectedToday || prnPending !== null}
                            loading={prnPending === entry.plan.request.id}
                            haptic="success"
                            accessibilityLabel={`${t('logDoseCta')}, ${entry.plan.label}`}
                            onPress={() => void logAsNeeded(entry.plan)}
                          />
                        </View>
                      );
                    })}
                  </Card>
                </View>
              ) : null}

              <SharedWithMeCard />
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
  prnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
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
    gap: spacing(2),
  },
});
