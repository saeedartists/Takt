import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedDoseRow,
  AnimatedNumber,
  Button,
  Card,
  IconButton,
  ProgressRing,
  Tile,
  TileIcon,
  EmptyState,
  ErrorState,
  FloatingUndoToast,
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
  font,
} from '@/components/ui';
import { MedicationGlyph } from '@/components/takt/medication-glyph';
import { INK } from '@/theme/tokens';
import { LOW_SUPPLY_THRESHOLD, getSupplySnapshot } from '@/lib/takt/supply-tracker';
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
  if (hour < 12) return { name: 'sunny-outline' as const, color: c.accent };
  if (hour < 18) return { name: 'partly-sunny-outline' as const, color: c.accent };
  return { name: 'moon-outline' as const, color: c.tones.lilac.solid };
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
  // Past midnight (app left open, or resumed next morning) follow the new day, unless the user picked another day.
  const todayKey = isoDateKey(now);
  const lastTodayKey = useRef(todayKey);
  useEffect(() => {
    if (lastTodayKey.current === todayKey) return;
    const previous = lastTodayKey.current;
    lastTodayKey.current = todayKey;
    setSelectedDate((selected) => (isoDateKey(selected) === previous ? new Date() : selected));
  }, [todayKey]);

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

  // The one medication closest to running out (at or under the low-supply line), for the bento tile.
  const [lowSupply, setLowSupply] = useState<{ label: string; count: number; requestId: string } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        let lowest: { label: string; count: number; requestId: string } | null = null;
        for (const plan of plans.plans) {
          const id = plan.medication?.id;
          if (!id || plan.request.status !== 'active') continue;
          const snap = await getSupplySnapshot(id);
          if (!snap || snap.count > LOW_SUPPLY_THRESHOLD) continue;
          if (!lowest || snap.count < lowest.count) lowest = { label: plan.label, count: snap.count, requestId: plan.request.id };
        }
        if (active) setLowSupply(lowest);
      })();
      return () => {
        active = false;
      };
    }, [plans.plans]),
  );

  // Days in a row (up to a week back, today excluded) with every scheduled dose taken.
  const rhythmDays = useMemo(() => {
    let days = 0;
    for (let offset = 1; offset <= 7; offset++) {
      const day = adherenceMap[isoDateKey(addDays(now, -offset))];
      if (!day || day.total === 0 || day.taken < day.total) break;
      days += 1;
    }
    return days;
  }, [adherenceMap, now]);

  const planByRequest = useMemo(() => new Map(plans.plans.map((plan) => [plan.request.id, plan])), [plans.plans]);

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
  const hour = now.getHours();
  const greeting = hour < 12 ? t('greetingMorning') : hour < 18 ? t('greetingAfternoon') : t('greetingEvening');
  const todayTotal = todayDoses.length;
  const todayTaken = takenToday;
  // The dose after the one the hero is showing: what the next reminder will be about.
  const heroDose = todayDoses.find((d) => d.state === 'due') ?? todayDoses.find((d) => d.state === 'scheduled');
  const nextReminder = todayDoses.find((d) => d.state === 'scheduled' && d.id !== heroDose?.id);
  const hasSecondTile = Boolean(lowSupply) || rhythmDays >= 2 || Boolean(nextReminder);
  let rowIndex = 0;

  return (
    <View style={{ flex: 1 }}>
      <PageShell>
        {/* Greeting row: who, and a one-tap way to the doctor report. */}
        <View style={styles.greetingRow}>
          <View style={[styles.avatar, { backgroundColor: c.tones.lilac.bg }]}>
            <Text style={[typography.title3, { color: INK }]}>{(patientFirstName ?? 'T').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[typography.subhead, { color: c.textSecondary }]}>
              {patientFirstName ? `${greeting},` : greeting}
            </Text>
            {patientFirstName ? (
              <Text numberOfLines={1} style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold, fontSize: 18 }]}>
                {patientFirstName}
              </Text>
            ) : null}
          </View>
          <IconButton icon="document-text-outline" accessibilityLabel={t('openReport')} onPress={() => router.push('/report')} />
        </View>

        <Text accessibilityRole="header" style={[typography.display, styles.dateTitle, { color: c.textPrimary }]}>
          {`${formatDate(now, { weekday: 'long' })},\n`}
          <Text style={{ color: c.textTertiary }}>{formatDate(now, { day: 'numeric', month: 'long' })}</Text>
        </Text>

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
              <Animated.View entering={enter(0)}>
                <WeekStripPicker
                  selectedDate={selectedDate}
                  onSelectDate={(d) => setSelectedDate(d)}
                  adherenceMap={adherenceMap}
                  todayLabel={t('today')}
                />
              </Animated.View>

              <Animated.View entering={enter(1)}>
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
              </Animated.View>

              {/* Bento: today's count, plus supply or rhythm when there is something to say. */}
              {/* Once everything is taken the hero already says so; the count tile would repeat it. */}
              {todayTotal > 0 && todayTaken < todayTotal ? (
                <Animated.View entering={enter(2)} style={styles.bento}>
                  <Tile
                    tone="sage"
                    style={[styles.bentoTile, !hasSecondTile && styles.bentoWide]}
                    onPress={() => router.push('/history')}
                    accessibilityLabel={t('takenOfTotal').replace('{taken}', String(todayTaken)).replace('{total}', String(todayTotal))}
                  >
                    <View style={styles.bentoHead}>
                      <Text style={[typography.subhead, { color: INK, fontFamily: font.semibold }]}>{t('todayTakenTile')}</Text>
                      <ProgressRing progress={todayTaken / todayTotal} size={40} stroke={5} color={c.tones.sage.solid} track="rgba(255,255,255,0.8)" />
                    </View>
                    <View style={styles.metricRow}>
                      <AnimatedNumber value={todayTaken} style={[typography.metric, { color: INK }]} />
                      <Text style={[typography.title3, { color: c.tones.sage.fg }]}>{` / ${todayTotal}`}</Text>
                    </View>
                    <Text style={[typography.subhead, { color: c.tones.sage.fg }]}>
                      {t('takenOfTotal').replace('{taken}', String(todayTaken)).replace('{total}', String(todayTotal))}
                    </Text>
                  </Tile>
                  {lowSupply ? (
                    <Tile
                      tone="butter"
                      style={styles.bentoTile}
                      onPress={() => router.push(`/medications/${lowSupply.requestId}` as never)}
                      accessibilityLabel={`${t('todayRefillTile')}, ${lowSupply.label}, ${t('supplyLeft').replace('{count}', String(lowSupply.count))}`}
                    >
                      <View style={styles.bentoHead}>
                        <Text style={[typography.subhead, { color: INK, fontFamily: font.semibold }]}>{t('todayRefillTile')}</Text>
                        <TileIcon name="add-circle-outline" />
                      </View>
                      <View style={styles.metricRow}>
                        <AnimatedNumber value={lowSupply.count} style={[typography.metric, { color: INK }]} />
                      </View>
                      <Text numberOfLines={1} style={[typography.subhead, { color: c.tones.butter.fg }]}>
                        {`${lowSupply.label} · ${t('supplyLeft').replace('{count}', String(lowSupply.count))}`}
                      </Text>
                    </Tile>
                  ) : rhythmDays >= 2 ? (
                    <Tile tone="lilac" style={styles.bentoTile} accessibilityLabel={`${t('todayInRhythmTile')}, ${rhythmDays}`}>
                      <View style={styles.bentoHead}>
                        <Text style={[typography.subhead, { color: INK, fontFamily: font.semibold }]}>{t('todayInRhythmTile')}</Text>
                        <TileIcon name="pulse" />
                      </View>
                      <View style={styles.metricRow}>
                        <AnimatedNumber value={rhythmDays} style={[typography.metric, { color: INK }]} />
                      </View>
                      <Text style={[typography.subhead, { color: c.tones.lilac.fg }]}>{t('todayInRhythmHint')}</Text>
                    </Tile>
                  ) : nextReminder ? (
                    <Tile tone="sky" style={styles.bentoTile} accessibilityLabel={`${t('todayNextReminderTile')}, ${formatTime(nextReminder.scheduledAt)}, ${nextReminder.label}`}>
                      <View style={styles.bentoHead}>
                        <Text style={[typography.subhead, { color: INK, fontFamily: font.semibold }]}>{t('todayNextReminderTile')}</Text>
                        <TileIcon name="notifications-outline" />
                      </View>
                      <Text style={[typography.metricSm, { color: INK, fontVariant: ['tabular-nums'] }]}>{formatTime(nextReminder.scheduledAt)}</Text>
                      <Text numberOfLines={1} style={[typography.subhead, { color: c.tones.sky.fg }]}>{nextReminder.label}</Text>
                    </Tile>
                  ) : null}
                </Animated.View>
              ) : null}

              {/* Auto-marked misses are fixable on the rows below, so the notice goes once none is left. */}
              {autoMissedCount > 0 && todayDoses.some((dose) => dose.state === 'missed') ? (
                <Card>
                  <View style={styles.noticeRow}>
                    <Ionicons name="information-circle-outline" size={20} color={c.textSecondary} />
                    <Text style={[typography.subhead, { color: c.textSecondary, flex: 1, minWidth: 0 }]}>
                      {autoMissedCount === 1
                        ? t('autoMissedNoticeOne')
                        : t('autoMissedNoticeMany').replace('{count}', String(autoMissedCount))}
                    </Text>
                  </View>
                </Card>
              ) : null}

              {actionError ? (
                <Animated.Text
                  entering={FadeInDown.duration(200)}
                  accessibilityRole="alert"
                  style={[typography.subhead, { color: c.destructive, paddingHorizontal: spacing(1) }]}
                >
                  {actionError}
                </Animated.Text>
              ) : null}

              <View>
                <SectionHeader
                  title={
                    isSelectedToday
                      ? t('timeline')
                      : formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })
                  }
                  action={
                    selectedDoses.length > 0 ? (
                      <Text style={[typography.subhead, { color: c.textTertiary }]}>
                        {`${selectedDoses.length} ${selectedDoses.length === 1 ? t('singleDoseLabel') : t('multipleDosesLabel')}`}
                      </Text>
                    ) : undefined
                  }
                />

                {grouped.length === 0 ? (
                  <EmptyState
                    title={t('noDosesToday')}
                    description={needsFirstMedication ? t('addMedicationHint') : undefined}
                    action={
                      needsFirstMedication ? (
                        <Button
                          label={t('addMedication')}
                          accentIcon="add"
                          fullWidth={false}
                          onPress={() => router.push('/medications/new')}
                        />
                      ) : undefined
                    }
                  />
                ) : (
                  <View style={styles.groups}>
                    {grouped.map((bucket) => {
                      const timeIcon = getTimeIcon(bucket.doses[0]?.scheduledAt.getHours() ?? 12, c);
                      const actionable = bucket.doses.filter(isActionable);

                      return (
                        <Animated.View key={bucket.time} layout={LinearTransition.springify().damping(24).stiffness(200)} style={styles.group}>
                          <View style={styles.timeHeader}>
                            <View style={styles.timeHeaderLeft}>
                              <View style={[styles.timeIcon, { backgroundColor: c.surface }]}>
                                <Ionicons name={timeIcon.name} size={16} color={timeIcon.color} />
                              </View>
                              <Text style={[typography.title3, { color: c.textPrimary, fontVariant: ['tabular-nums'] }]}>
                                {bucket.time}
                              </Text>
                            </View>
                            {actionable.length >= 2 ? (
                              <Button
                                size="sm"
                                fullWidth={false}
                                label={t('confirmAllAt').replace('{count}', String(actionable.length))}
                                icon={<Ionicons name="checkmark-done" size={18} color={c.onInk} />}
                                loading={bulkPending}
                                disabled={heroPending !== null}
                                haptic="success"
                                accessibilityLabel={`${t('confirmAllAt').replace('{count}', String(actionable.length))}, ${bucket.time}`}
                                onPress={() => void confirmAll(actionable)}
                              />
                            ) : null}
                          </View>
                          {bucket.doses.map((dose, index) => {
                            const isFocused =
                              typeof params.focus === 'string' &&
                              params.focus === reminderDoseKey(dose.requestId, dose.scheduledAt);
                            const entering = firstLoadDone.current ? undefined : enter(3 + rowIndex++);
                            const plan = planByRequest.get(dose.requestId);

                            return (
                              <Animated.View key={dose.id} entering={entering} layout={LinearTransition.springify().damping(24).stiffness(200)}>
                                <AnimatedDoseRow
                                  dose={dose}
                                  isFirst={index === 0}
                                  isFocused={isFocused}
                                  canUndo={canUndo(dose)}
                                  stateLabel={stateLabel(dose.state)}
                                  instruction={describeInstruction(dose, t)}
                                  detail={doseDetail(dose)}
                                  leading={<MedicationGlyph appearance={plan?.appearance} form={plan?.form} size={52} />}
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
                        </Animated.View>
                      );
                    })}
                  </View>
                )}
              </View>

              {asNeededLog.length > 0 ? (
                <View>
                  <SectionHeader title={t('cadenceAsNeeded')} />
                  <View style={styles.groups}>
                    {asNeededLog.map((entry) => {
                      const last = entry.doses[entry.doses.length - 1];
                      const line = last
                        ? t('asNeededTakenToday')
                            .replace('{count}', String(entry.doses.length))
                            .replace('{time}', formatTime(last.scheduledAt))
                        : t('asNeededNoneToday');
                      return (
                        <Animated.View
                          key={entry.plan.request.id}
                          layout={LinearTransition}
                          style={[styles.prnCard, { borderColor: c.separator }]}
                        >
                          <MedicationGlyph appearance={entry.plan.appearance} form={entry.plan.form} size={48} />
                          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                            <Text numberOfLines={2} style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>
                              {entry.plan.label}
                            </Text>
                            <Text style={[typography.subhead, { color: c.textSecondary }]}>
                              {[
                                entry.plan.strength,
                                entry.plan.maxPerDay ? t('asNeededUpTo').replace('{count}', String(entry.plan.maxPerDay)) : undefined,
                                describeInstruction(entry.plan, t),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                            <Animated.Text
                              key={line}
                              entering={FadeInDown.duration(200)}
                              style={[typography.subhead, { color: last ? c.success : c.textSecondary, fontFamily: font.semibold }]}
                            >
                              {entry.atMax ? t('asNeededMaxReached') : line}
                            </Animated.Text>
                          </View>
                          <Button
                            size="sm"
                            fullWidth={false}
                            label={t('logDoseCta')}
                            icon={<Ionicons name="add" size={18} color={c.onInk} />}
                            disabled={entry.atMax || !isSelectedToday || prnPending !== null}
                            loading={prnPending === entry.plan.request.id}
                            haptic="success"
                            accessibilityLabel={`${t('logDoseCta')}, ${entry.plan.label}`}
                            onPress={() => void logAsNeeded(entry.plan)}
                          />
                        </Animated.View>
                      );
                    })}
                  </View>
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
        dismissLabel={t('dismissNotice')}
        onUndo={() => void handleUndoToast()}
        onDismiss={() => setUndoToast(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dateTitle: { marginTop: spacing(5), marginBottom: spacing(5) },
  bento: { flexDirection: 'row', gap: spacing(3) },
  bentoTile: { flex: 1, gap: spacing(2), padding: spacing(4.5) },
  bentoWide: { paddingVertical: spacing(4) },
  bentoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(2), minHeight: 40 },
  metricRow: { flexDirection: 'row', alignItems: 'baseline' },
  groups: { gap: spacing(2.5) },
  group: { gap: spacing(2.5), marginBottom: spacing(2) },
  prnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3.5),
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(4.5),
    paddingVertical: spacing(3.5),
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingHorizontal: spacing(1),
    minHeight: 44,
  },
  timeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
  },
  timeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
