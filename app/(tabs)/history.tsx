import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedNumber,
  AnimatedPressable,
  AnimatedSegmentedControl,
  Badge,
  Button,
  CONTENT_MAX_WIDTH,
  Card,
  EmptyState,
  ErrorState,
  INK,
  PageHeader,
  PageShell,
  SectionHeader,
  SkeletonCard,
  SkeletonRow,
  Stack,
  Tile,
  font,
  motion,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
  type BadgeTone,
  type IconName,
} from '@/components/ui';
import { MedicationGlyph } from '@/components/takt/medication-glyph';
import { AdherenceBars, type AdherenceBarDay } from '@/components/ui/sparkline';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useRecordDose, useUndoDose } from '@/lib/hooks/use-takt-mutations';
import { TimeField } from '@/components/takt/time-field';
import { buildHistoryCsv } from '@/lib/takt/history-csv';
import { useLocale } from '@/lib/takt/l10n';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { buildHistory, type HistoryDay } from '@/lib/takt/schedule';
import { addDays, atClockTime, isoDateKey, startOfDay } from '@/lib/takt/time';
import type { DoseOccurrence, MedicationPlan, SkipReason } from '@/lib/takt/types';
import { semantic } from '@/theme/tokens';

const reasonKey = (code: SkipReason) =>
  code === 'forgot'
    ? ('skipReasonForgot' as const)
    : code === 'side-effects'
      ? ('skipReasonSideEffects' as const)
      : code === 'ran-out'
        ? ('skipReasonRanOut' as const)
        : code === 'not-needed'
          ? ('skipReasonNotNeeded' as const)
          : ('skipReasonOther' as const);

const clockOf = (iso: string): string => {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

type CorrectionAction = 'taken' | 'skipped' | 'missed';
type DoseWithDay = DoseOccurrence & { dayLabel: string };
type Note = { tone: 'success' | 'error'; text: string };

/*
 * One meaning per tone: sage = taken, butter = skipped, rose = missed.
 * The segmented thumb uses the light-mode solids so its white label stays
 * AA in dark mode too.
 */
const STATE_META: Record<CorrectionAction, { badge: BadgeTone; icon: IconName; thumb: string }> = {
  taken: { badge: 'success', icon: 'checkmark', thumb: semantic.light.tones.sage.solid },
  skipped: { badge: 'warning', icon: 'pause', thumb: semantic.light.tones.butter.solid },
  missed: { badge: 'destructive', icon: 'close', thumb: semantic.light.tones.rose.solid },
};

/** Missed doses shown before "Show all": the newest few are the ones worth fixing. */
const MISSED_PREVIEW = 4;

const layoutGlide = LinearTransition.springify()
  .damping(motion.spring.settle.damping)
  .stiffness(motion.spring.settle.stiffness);

export default function HistoryScreen() {
  const { c } = useTokens();
  const { t, formatDate, formatTime, locale } = useLocale();
  const { enter } = useMotion();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const recordDose = useRecordDose();
  const undoDose = useUndoDose();
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<Note | null>(null);
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(14);
  const [pendingDoseId, setPendingDoseId] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Calendar: first of the shown month, the slide direction of the last change, and the opened day.
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [monthDir, setMonthDir] = useState<-1 | 0 | 1>(0);
  const [openDay, setOpenDay] = useState<HistoryDay | null>(null);
  const [allMissed, setAllMissed] = useState(false);

  const prefs = useReminderPreferences();
  const graceHours = prefs.data?.graceHours;

  const history = useMemo(
    () => buildHistory(plans.plans, (events.data?.entry ?? []).map((x) => x.resource), windowDays, { graceHours }),
    [events.data?.entry, graceHours, plans.plans, windowDays],
  );

  // Plain counts for this week and last, no grading (brief §7).
  const weekly = useMemo(() => {
    const days = buildHistory(plans.plans, (events.data?.entry ?? []).map((x) => x.resource), 14, { graceHours });
    const sum = (rows: typeof days) =>
      rows.reduce(
        (acc, day) => ({ taken: acc.taken + day.taken, total: acc.total + day.taken + day.skipped + day.missed }),
        { taken: 0, total: 0 },
      );
    return { thisWeek: sum(days.slice(7)), lastWeek: sum(days.slice(0, 7)) };
  }, [events.data?.entry, graceHours, plans.plans]);

  const totals = useMemo(() => {
    const all = history.reduce(
      (acc, day) => {
        acc.taken += day.taken;
        acc.skipped += day.skipped;
        acc.missed += day.missed;
        return acc;
      },
      { taken: 0, skipped: 0, missed: 0 },
    );
    const denominator = all.taken + all.skipped + all.missed;
    return {
      ...all,
      denominator,
      adherencePct: denominator > 0 ? Math.round((all.taken / denominator) * 100) : 0,
    };
  }, [history]);

  // Same-length window just before this one; a plain difference, no verdict (brief §7).
  const trend = useMemo(() => {
    const days = buildHistory(plans.plans, (events.data?.entry ?? []).map((x) => x.resource), windowDays * 2, { graceHours });
    const prev = days.slice(0, Math.max(0, days.length - windowDays)).reduce(
      (acc, day) => ({ taken: acc.taken + day.taken, total: acc.total + day.taken + day.skipped + day.missed }),
      { taken: 0, total: 0 },
    );
    if (prev.total === 0 || totals.denominator === 0) return null;
    return totals.adherencePct - Math.round((prev.taken / prev.total) * 100);
  }, [events.data?.entry, graceHours, plans.plans, totals.adherencePct, totals.denominator, windowDays]);

  // The shown month up to today (or its last day), built the same way as the chart.
  const monthDays = useMemo(() => {
    const today = startOfDay(new Date());
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const end = last < today ? last : today;
    if (end < month) return [];
    return buildHistory(plans.plans, (events.data?.entry ?? []).map((x) => x.resource), end.getDate(), {
      today: end,
      graceHours,
    });
  }, [events.data?.entry, graceHours, month, plans.plans]);

  const shiftMonth = (dir: -1 | 1) => {
    setMonthDir(dir);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + dir, 1));
  };

  const planById = useMemo(() => new Map(plans.plans.map((plan) => [plan.request.id, plan])), [plans.plans]);

  const barDays = useMemo<AdherenceBarDay[]>(() => {
    const todayKey = isoDateKey(new Date());
    const n = history.length;
    return history.map((day, i) => {
      const isToday = day.key === todayKey;
      // ≤14 days: weekday initial on every bar; 30 days: day-of-month every 5th bar (counted from today).
      const showLabel = n <= 14 || (n - 1 - i) % 5 === 0;
      const label = !showLabel
        ? ''
        : n <= 14
          ? formatDate(day.date, { weekday: 'narrow' })
          : formatDate(day.date, { day: 'numeric' });
      return {
        key: day.key,
        label,
        pct: day.adherencePct,
        logged: day.taken + day.skipped + day.missed > 0,
        isToday,
      };
    });
  }, [formatDate, history]);

  const missed = useMemo(
    () =>
      history
        .flatMap((day) =>
          day.doses
            .filter((dose) => dose.state === 'missed')
            .map((dose) => ({
              id: dose.id,
              title: dose.label,
              subtitle: `${formatDate(day.date, { month: 'short', day: 'numeric' })} · ${formatTime(
                dose.scheduledAt,
              )}`,
              requestId: dose.requestId,
              scheduledAt: dose.scheduledAt,
              medicationRef: dose.medicationRef,
              eventId: dose.eventId,
            })),
        )
        .reverse()
        .slice(0, 30),
    [formatDate, formatTime, history],
  );

  const correctionRows = useMemo<DoseWithDay[]>(
    () =>
      history
        .flatMap((day) =>
          day.doses
            .filter(
              (dose): dose is DoseOccurrence & { state: CorrectionAction } =>
                dose.state === 'taken' || dose.state === 'skipped' || dose.state === 'missed',
            )
            .map((dose) => ({
              ...dose,
              dayLabel: formatDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' }),
            })),
        )
        .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
        .slice(0, 12),
    [formatDate, history],
  );

  // Rows are newest-first, so same-day rows are adjacent: one pass groups them.
  const correctionGroups = useMemo(() => {
    const groups: { dayLabel: string; rows: DoseWithDay[] }[] = [];
    for (const row of correctionRows) {
      const last = groups[groups.length - 1];
      if (last && last.dayLabel === row.dayLabel) last.rows.push(row);
      else groups.push({ dayLabel: row.dayLabel, rows: [row] });
    }
    return groups;
  }, [correctionRows]);

  const exportCsv = async () => {
    setActionError(null);
    setExportNote(null);
    setExportingCsv(true);

    try {
      const bundle = (events.data?.entry ?? []).map((entry) => entry.resource);
      const { fileName, csv } = buildHistoryCsv({
        plans: plans.plans,
        events: bundle,
        locale,
        headers: {
          date: t('csvColumnDate'),
          medication: t('csvColumnMedication'),
          time: t('csvColumnTime'),
          status: t('csvColumnStatus'),
          actualTime: t('csvColumnActualTime'),
        },
        statusLabels: {
          taken: t('statusTaken'),
          skipped: t('statusSkipped'),
          missed: t('statusMissed'),
        },
        summaryLabel: t('csvSummaryAdherence'),
      });

      if (Platform.OS === 'web') {
        // No share sheet or file system in the browser: hand the file to the download manager.
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
        setExportNote({ tone: 'success', text: t('csvWebDownloaded') });
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        setExportNote({ tone: 'error', text: t('sharingUnavailable') });
        return;
      }

      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) {
        setExportNote({ tone: 'error', text: t('csvExportError') });
        return;
      }

      const uri = `${baseDir}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, {
        mimeType: 'text/csv',
        dialogTitle: t('exportCsv'),
        UTI: 'public.comma-separated-values-text',
      });
      setExportNote({ tone: 'success', text: t('csvExportDone') });
    } catch {
      setExportNote({ tone: 'error', text: t('csvExportError') });
    } finally {
      setExportingCsv(false);
    }
  };

  /** `effectiveAt` lets a taken dose carry the real time it was taken ("taken late"). */
  const rewriteDoseState = async (dose: DoseWithDay, action: CorrectionAction, effectiveAt?: Date) => {
    if (!patientRef) return;

    if (dose.state === action && dose.eventId && !effectiveAt) {
      return;
    }

    setActionError(null);
    setPendingDoseId(dose.id);

    try {
      if (dose.eventId) {
        await undoDose.mutateAsync(dose.eventId);
      }

      await recordDose.mutateAsync({
        patientRef,
        medicationRef: dose.medicationRef,
        requestRef: `MedicationRequest/${dose.requestId}`,
        scheduledAt: dose.scheduledAt,
        action,
        effectiveAt,
      });
    } catch {
      setActionError(t('historyCorrectionError'));
    } finally {
      setPendingDoseId(null);
    }
  };

  const clearDoseLog = async (dose: DoseWithDay) => {
    if (!dose.eventId) return;

    setActionError(null);
    setPendingDoseId(dose.id);

    try {
      await undoDose.mutateAsync(dose.eventId);
    } catch {
      setActionError(t('historyCorrectionError'));
    } finally {
      setPendingDoseId(null);
    }
  };

  const markTaken = async (item: (typeof missed)[number]) => {
    if (!patientRef) return;

    setActionError(null);

    try {
      if (item.eventId) {
        await undoDose.mutateAsync(item.eventId);
      }

      await recordDose.mutateAsync({
        patientRef,
        medicationRef: item.medicationRef,
        requestRef: `MedicationRequest/${item.requestId}`,
        scheduledAt: item.scheduledAt,
        action: 'taken',
      });
    } catch {
      setActionError(t('historyCorrectionError'));
    }
  };

  const isLoading = patient.isLoading || plans.isLoading || events.isLoading;

  const lilac = c.tones.lilac;
  const windowText = t('adherenceWindowDays').replace('{days}', windowDays.toString());
  const onScheduleTitle = t('takenOnSchedule').charAt(0).toUpperCase() + t('takenOnSchedule').slice(1);
  const stats = [
    { key: 'taken', label: t('statusTaken'), value: totals.taken, tone: 'sage' },
    { key: 'missed', label: t('statusMissed'), value: totals.missed, tone: 'rose' },
    { key: 'skipped', label: t('statusSkipped'), value: totals.skipped, tone: 'butter' },
  ] as const;

  return (
    <PageShell>
      <PageHeader
        title={t('history')}
        subtitle={windowText}
        action={
          <AnimatedPressable
            accessibilityRole="link"
            accessibilityLabel={t('openReport')}
            haptic="light"
            scaleTo={0.96}
            onPress={() => router.push('/report')}
            style={[styles.reportPill, { backgroundColor: c.surface }]}
          >
            <Ionicons name="document-text-outline" size={20} color={c.textPrimary} />
            <Text style={[typography.callout, { color: c.textPrimary, fontFamily: font.bold }]}>{t('report')}</Text>
          </AnimatedPressable>
        }
      />

      <Stack>
        <AnimatedSegmentedControl
          track="surface"
          value={windowDays.toString()}
          onChange={(next) => setWindowDays(Number.parseInt(next, 10) as 7 | 14 | 30)}
          options={[
            { value: '7', label: t('historyWindow7') },
            { value: '14', label: t('historyWindow14') },
            { value: '30', label: t('historyWindow30') },
          ]}
        />

        {isLoading ? (
          <>
            <SkeletonCard rows={2} />
            <Card>
              {[0, 1, 2].map((i) => (
                <SkeletonRow key={i} isFirst={i === 0} />
              ))}
            </Card>
          </>
        ) : patient.error || plans.error || events.error ? (
          <ErrorState
            description={t('loadHistoryError')}
            onRetry={() => {
              void patient.refetch();
              void plans.requestsQuery.refetch();
              void plans.medicationsQuery.refetch();
              void events.refetch();
            }}
          />
        ) : history.length === 0 ? (
          <EmptyState title={t('noAdherenceHistory')} description={t('historyNeedsSchedule')} />
        ) : (
          <>
            <View style={{ gap: spacing(3) }}>
              {/* Insights hero: lilac. The figure is a record, not a verdict — no traffic-light grading (brief §7, §12). */}
              <Animated.View entering={enter(0)}>
                <Tile tone="lilac" style={styles.hero}>
                  <View style={styles.heroTop}>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={[typography.headline, { color: lilac.fg }]}>{onScheduleTitle}</Text>
                      <View style={styles.pctRow}>
                        <AnimatedNumber
                          value={totals.adherencePct}
                          accessibilityLabel={`${totals.adherencePct.toString()}% ${t('takenOnSchedule')}`}
                          style={[styles.heroPct, { color: totals.denominator === 0 ? lilac.fg : INK }]}
                        />
                        <Text aria-hidden style={[styles.heroPctUnit, { color: totals.denominator === 0 ? lilac.fg : INK }]}>
                          %
                        </Text>
                      </View>
                    </View>
                    {trend !== null ? (
                      <View
                        accessible
                        accessibilityLabel={t('historyTrendA11y')
                          .replace('{days}', windowDays.toString())
                          .replace('{delta}', `${trend > 0 ? '+' : ''}${trend.toString()}`)}
                        style={styles.trendChip}
                      >
                        <Ionicons name={trend > 0 ? 'arrow-up' : trend < 0 ? 'arrow-down' : 'remove'} size={16} color={INK} />
                        <Text style={[typography.footnote, { color: INK, fontFamily: font.bold }]}>
                          {t('historyTrendVsBefore').replace('{delta}', `${Math.abs(trend).toString()}%`)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <AdherenceBars
                    days={barDays}
                    accessibilityLabel={`${t('adherenceTrend')} · ${windowText}`}
                  />
                  {totals.denominator === 0 ? (
                    <Text style={[typography.footnote, { color: lilac.fg }]}>{t('reportNoDataInWindow')}</Text>
                  ) : null}
                </Tile>
              </Animated.View>

              <View style={styles.statRow}>
                {stats.map((stat, i) => (
                  <Animated.View
                    key={stat.key}
                    entering={enter(i + 1)}
                    accessible
                    accessibilityLabel={`${stat.value.toString()} ${stat.label}`}
                    style={styles.statCell}
                  >
                    <Tile tone={stat.tone} style={styles.statTile}>
                      <AnimatedNumber value={stat.value} delay={120 + i * 60} style={[styles.statNumber, { color: INK }]} />
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[typography.subhead, { color: c.tones[stat.tone].fg, fontFamily: font.semibold }]}
                      >
                        {stat.label}
                      </Text>
                    </Tile>
                  </Animated.View>
                ))}
              </View>

              <Animated.View entering={enter(4)}>
                <Card style={styles.weekLinkCard}>
                  <AnimatedPressable
                    accessibilityRole="link"
                    accessibilityLabel={`${t('weekRouteTitle')}, ${t('weekHistoryRowHint')}`}
                    haptic="light"
                    scaleTo={0.98}
                    onPress={() => router.push('/week')}
                    style={styles.weekLink}
                  >
                    <View style={[styles.weekLinkIcon, { backgroundColor: lilac.bg }]}>
                      <Ionicons name="sparkles-outline" size={20} color={lilac.fg} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>{t('weekRouteTitle')}</Text>
                      <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('weekHistoryRowHint')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={c.textTertiary} />
                  </AnimatedPressable>
                </Card>
              </Animated.View>

              <Animated.View entering={enter(4)}>
                <MonthCalendar
                  month={month}
                  days={monthDays}
                  dir={monthDir}
                  onShift={shiftMonth}
                  onOpenDay={setOpenDay}
                />
              </Animated.View>

              <Animated.View entering={enter(5)}>
                <Card style={styles.weekCard}>
                  <Text style={[typography.headline, { color: c.textSecondary }]}>{t('weeklySummaryTitle')}</Text>
                  <Text style={[typography.title3, { color: c.textPrimary, fontVariant: ['tabular-nums'] }]}>
                    {t('weeklySummaryLine')
                      .replace('{taken}', String(weekly.thisWeek.taken))
                      .replace('{total}', String(weekly.thisWeek.total))}
                  </Text>
                  <Text style={[typography.footnote, { color: c.textTertiary, fontVariant: ['tabular-nums'] }]}>
                    {t('weeklySummaryLastWeek')
                      .replace('{taken}', String(weekly.lastWeek.taken))
                      .replace('{total}', String(weekly.lastWeek.total))}
                  </Text>
                </Card>
              </Animated.View>

              <Animated.View entering={enter(6)} style={{ gap: spacing(2) }}>
                <Button
                  kind="secondary"
                  label={t('exportCsv')}
                  icon={<Ionicons name="share-outline" size={20} color={c.textPrimary} />}
                  onPress={() => void exportCsv()}
                  loading={exportingCsv}
                  disabled={isLoading}
                  style={{ backgroundColor: c.surface }}
                />
                {exportNote ? (
                  <Text
                    accessibilityRole={exportNote.tone === 'error' ? 'alert' : undefined}
                    style={[
                      typography.footnote,
                      styles.dayLabel,
                      { color: exportNote.tone === 'error' ? c.destructive : c.textSecondary },
                    ]}
                  >
                    {exportNote.text}
                  </Text>
                ) : null}
              </Animated.View>
            </View>

            <View>
              <SectionHeader title={t('historyFixLogSectionTitle')} />
              {correctionGroups.length === 0 ? (
                <EmptyState title={t('historyFixLogEmptyTitle')} description={t('historyFixLogEmptyHint')} />
              ) : (
                <View style={{ gap: spacing(5) }}>
                  {correctionGroups.map((group, groupIndex) => (
                    <Animated.View
                      key={group.dayLabel}
                      entering={enter(groupIndex)}
                      layout={layoutGlide}
                      style={{ gap: spacing(2.5) }}
                    >
                      <Text
                        accessibilityRole="header"
                        style={[typography.overline, styles.dayLabel, { color: c.textTertiary }]}
                      >
                        {group.dayLabel}
                      </Text>
                      {group.rows.map((dose) => {
                        const pending = pendingDoseId === dose.id;
                        return (
                          <DoseLogRow
                            key={dose.id}
                            dose={dose}
                            plan={planById.get(dose.requestId)}
                            expanded={expandedId === dose.id}
                            pending={pending}
                            disabled={pending || recordDose.isPending || undoDose.isPending}
                            onToggle={() => setExpandedId((open) => (open === dose.id ? null : dose.id))}
                            onChangeState={(next) => void rewriteDoseState(dose, next)}
                            onChangeTime={(next) => void rewriteDoseState(dose, 'taken', atClockTime(dose.scheduledAt, next))}
                            onClear={() => void clearDoseLog(dose)}
                          />
                        );
                      })}
                    </Animated.View>
                  ))}
                </View>
              )}
            </View>

            {totals.denominator === 0 ? null : (
              <View>
                <SectionHeader title={t('missedDoses')} />
                {missed.length === 0 ? (
                  <EmptyState title={t('allCaughtUp')} description={t('greatRhythm')} />
                ) : (
                  <Card style={styles.missedList}>
                    {(allMissed ? missed : missed.slice(0, MISSED_PREVIEW)).map((item, i) => (
                      <Animated.View
                        key={item.id}
                        entering={enter(i)}
                        layout={layoutGlide}
                        style={[styles.missedRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}
                      >
                        <View style={[styles.stateGlyph, { backgroundColor: c.tones.rose.bg }]}>
                          <Ionicons name="close" size={20} color={c.tones.rose.fg} />
                        </View>
                        <View style={styles.missedBody}>
                          <View>
                            <Text numberOfLines={1} style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>
                              {item.title}
                            </Text>
                            <Text style={[typography.subhead, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>{item.subtitle}</Text>
                          </View>
                          <Button
                            kind="secondary"
                            size="sm"
                            fullWidth={false}
                            icon={<Ionicons name="checkmark" size={16} color={c.textPrimary} />}
                            label={t('markTakenFromHistory')}
                            onPress={() => void markTaken(item)}
                            disabled={recordDose.isPending || undoDose.isPending}
                          />
                        </View>
                      </Animated.View>
                    ))}
                    {!allMissed && missed.length > MISSED_PREVIEW ? (
                      <AnimatedPressable
                        onPress={() => setAllMissed(true)}
                        accessibilityRole="button"
                        style={[styles.showAll, { borderTopColor: c.separator }]}
                      >
                        <Text style={[typography.callout, { color: c.textPrimary, fontFamily: font.semibold }]}>
                          {t('historyShowAllMissed').replace('{count}', String(missed.length))}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color={c.textSecondary} />
                      </AnimatedPressable>
                    ) : null}
                  </Card>
                )}
              </View>
            )}

            {actionError ? (
              <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>
                {actionError}
              </Text>
            ) : null}
          </>
        )}
      </Stack>

      <DaySheet day={openDay} planById={planById} onClose={() => setOpenDay(null)} />
    </PageShell>
  );
}

type DayMark = 'all' | 'partly' | 'missed' | 'planned' | 'none' | 'future';

const dayMark = (day: HistoryDay | undefined): DayMark => {
  if (!day) return 'future';
  if (day.doses.length === 0) return 'none';
  if (day.missed > 0) return 'missed';
  if (day.taken === day.doses.length) return 'all';
  if (day.taken + day.skipped > 0) return 'partly';
  return 'planned';
};

// Any Monday: the weekday header runs Monday to Sunday in the user's language.
const MONDAY = new Date(2024, 0, 1);

/*
 * Month grid: sage = every dose taken, butter = some, rose ring = a dose
 * was missed, ink ring = today, faint = still ahead. Each day says the
 * same in words for screen readers; the legend spells it out on screen.
 */
const MonthCalendar = ({
  month,
  days,
  dir,
  onShift,
  onOpenDay,
}: {
  month: Date;
  days: HistoryDay[];
  dir: -1 | 0 | 1;
  onShift: (dir: -1 | 1) => void;
  onOpenDay: (day: HistoryDay) => void;
}) => {
  const { c } = useTokens();
  const { t, formatDate } = useLocale();
  const { reduce, duration } = useMotion();
  const todayKey = isoDateKey(new Date());
  const now = new Date();
  const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const lead = (month.getDay() + 6) % 7;
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const slide = reduce || dir === 0 ? undefined : (dir > 0 ? FadeInRight : FadeInLeft).duration(duration.slow);

  const label = (date: Date, day: HistoryDay | undefined, mark: DayMark): string => {
    const name = formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' });
    const at = isoDateKey(date) === todayKey ? `${t('today')}, ${name}` : name;
    const total = String(day?.doses.length ?? 0);
    const taken = String(day?.taken ?? 0);
    if (mark === 'all') return t('calendarDayAllTaken').replace('{date}', at).replace('{total}', total);
    if (mark === 'missed')
      return t('calendarDayMissed')
        .replace('{date}', at)
        .replace('{taken}', taken)
        .replace('{total}', total)
        .replace('{missed}', String(day?.missed ?? 0));
    if (mark === 'partly') return t('calendarDayPartly').replace('{date}', at).replace('{taken}', taken).replace('{total}', total);
    if (mark === 'planned') return t('calendarDayPlanned').replace('{date}', at).replace('{total}', total);
    return t('calendarDayNone').replace('{date}', at);
  };

  const arrow = (to: -1 | 1) => {
    const enabled = to < 0 || !isCurrent;
    return (
      <AnimatedPressable
        onPress={() => onShift(to)}
        disabled={!enabled}
        haptic="light"
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel={t(to < 0 ? 'calendarPrevMonth' : 'calendarNextMonth')}
        accessibilityState={{ disabled: !enabled }}
        style={[styles.monthArrow, { backgroundColor: c.surfaceRaised, opacity: enabled ? 1 : 0.35 }]}
      >
        <Ionicons name={to < 0 ? 'chevron-back' : 'chevron-forward'} size={20} color={c.textPrimary} />
      </AnimatedPressable>
    );
  };

  const legend = [
    { key: 'all', label: t('calendarAllTaken'), style: { backgroundColor: c.tones.sage.bg } },
    { key: 'partly', label: t('calendarPartly'), style: { backgroundColor: c.tones.butter.bg } },
    { key: 'missed', label: t('statusMissed'), style: { borderWidth: 2, borderColor: c.tones.rose.solid } },
  ];

  return (
    <Card style={styles.calendar}>
      <View style={styles.monthHead}>
        <Text accessibilityRole="header" style={[typography.title3, { color: c.textPrimary, flex: 1 }]}>
          {formatDate(month, { month: 'long', year: 'numeric' })}
        </Text>
        {arrow(-1)}
        {arrow(1)}
      </View>

      <View style={styles.weekRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} style={[typography.caption, styles.weekday, { color: c.textTertiary }]}>
            {formatDate(addDays(MONDAY, i), { weekday: 'narrow' })}
          </Text>
        ))}
      </View>

      <Animated.View key={isoDateKey(month)} entering={slide} style={styles.grid}>
        {cells.map((dayOfMonth, index) => {
          if (dayOfMonth === null) return <View key={`blank-${index}`} style={styles.dayCell} />;
          const date = new Date(month.getFullYear(), month.getMonth(), dayOfMonth);
          const day = days[dayOfMonth - 1];
          const mark = dayMark(day);
          const isToday = isoDateKey(date) === todayKey;
          const fill = mark === 'all' ? c.tones.sage.bg : mark === 'partly' ? c.tones.butter.bg : 'transparent';
          const ring = mark === 'missed' ? c.tones.rose.solid : isToday ? c.textPrimary : 'transparent';
          const onTone = mark === 'all' || mark === 'partly';
          const text =
            mark === 'future' ? c.textTertiary : onTone ? INK : mark === 'none' ? c.textSecondary : c.textPrimary;
          const circle = (
            <View style={[styles.dayCircle, { backgroundColor: fill, borderColor: ring }]}>
              <Text
                style={[
                  typography.subhead,
                  styles.dayNumber,
                  { color: text, fontFamily: isToday || onTone || mark === 'missed' ? font.bold : font.medium },
                  mark === 'future' && styles.future,
                ]}
              >
                {dayOfMonth}
              </Text>
            </View>
          );
          if (!day || day.doses.length === 0) {
            return (
              <View key={dayOfMonth} style={styles.dayCell} accessible accessibilityLabel={label(date, day, mark)}>
                {circle}
              </View>
            );
          }
          return (
            <AnimatedPressable
              key={dayOfMonth}
              onPress={() => onOpenDay(day)}
              scaleTo={0.88}
              accessibilityRole="button"
              accessibilityLabel={label(date, day, mark)}
              accessibilityHint={t('calendarDayHint')}
              style={styles.dayCell}
            >
              {circle}
            </AnimatedPressable>
          );
        })}
      </Animated.View>

      <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {legend.map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.legendDot, item.style]} />
            <Text style={[typography.caption, { color: c.textSecondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
};

/** One day's doses, read-only; corrections stay in "Fix a logged dose". */
const DaySheet = ({
  day,
  planById,
  onClose,
}: {
  day: HistoryDay | null;
  planById: Map<string, MedicationPlan>;
  onClose: () => void;
}) => {
  const { c } = useTokens();
  const { t, formatDate, formatTime } = useLocale();
  const insets = useSafeAreaInsets();
  if (!day) return null;

  const status = (state: DoseOccurrence['state']): { label: string; tone: BadgeTone; icon: IconName } =>
    state === 'taken' || state === 'skipped' || state === 'missed'
      ? {
          label: state === 'taken' ? t('statusTaken') : state === 'skipped' ? t('statusSkipped') : t('statusMissed'),
          tone: STATE_META[state].badge,
          icon: STATE_META[state].icon,
        }
      : state === 'due'
        ? { label: t('statusDue'), tone: 'accent', icon: 'alarm-outline' }
        : { label: t('statusScheduled'), tone: 'info', icon: 'time-outline' };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetWrap}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(21,23,28,0.45)' }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('calendarClose')}
        />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: spacing(4) + insets.bottom }]}>
          <View style={[styles.handle, { backgroundColor: c.separator }]} />
          <Text accessibilityRole="header" style={[typography.title2, { color: c.textPrimary }]}>
            {formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Text style={[typography.subhead, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>
            {t('takenOfTotal').replace('{taken}', String(day.taken)).replace('{total}', String(day.doses.length))}
          </Text>
          <View style={styles.sheetList}>
            {day.doses.map((dose, index) => {
              const plan = planById.get(dose.requestId);
              const meta = status(dose.state);
              return (
                <View
                  key={dose.id}
                  accessible
                  accessibilityLabel={`${dose.label}, ${formatTime(dose.scheduledAt)}, ${meta.label}`}
                  style={[styles.sheetRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}
                >
                  <MedicationGlyph appearance={plan?.appearance} form={plan?.form} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[typography.headline, { color: c.textPrimary }]}>
                      {dose.label}
                    </Text>
                    <Text style={[typography.subhead, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>
                      {formatTime(dose.scheduledAt)}
                    </Text>
                  </View>
                  <View>
                    <Badge label={meta.label} tone={meta.tone} icon={meta.icon} size="sm" />
                  </View>
                </View>
              );
            })}
          </View>
          <Button kind="secondary" label={t('calendarClose')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
};

/*
 * One logged dose. Collapsed: glyph, name · time, status badge. Tapping
 * opens the editor in place (the card grows with a layout glide); a status
 * change or new time is saved at once, as before.
 */
const DoseLogRow = ({
  dose,
  plan,
  expanded,
  pending,
  disabled,
  onToggle,
  onChangeState,
  onChangeTime,
  onClear,
}: {
  dose: DoseWithDay;
  plan?: MedicationPlan;
  expanded: boolean;
  pending: boolean;
  disabled: boolean;
  onToggle: () => void;
  onChangeState: (next: CorrectionAction) => void;
  onChangeTime: (next: string) => void;
  onClear: () => void;
}) => {
  const { c } = useTokens();
  const { t, formatTime } = useLocale();
  const state = dose.state as CorrectionAction;
  const meta = STATE_META[state];
  const time = formatTime(dose.scheduledAt);
  const statusLabel = state === 'taken' ? t('statusTaken') : state === 'skipped' ? t('statusSkipped') : t('statusMissed');
  const detail = expanded
    ? t('historyEditHint')
    : state === 'taken' && dose.eventTimestamp
      ? `${t('takenAtLabel')} ${formatTime(new Date(dose.eventTimestamp))}`
      : dose.reasonCode
        ? t(reasonKey(dose.reasonCode))
        : null;

  return (
    <Animated.View
      layout={layoutGlide}
      style={[styles.logRow, { backgroundColor: c.surface, borderColor: expanded ? c.textPrimary : 'transparent' }]}
    >
      <AnimatedPressable
        onPress={onToggle}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`${dose.label}, ${time}, ${statusLabel}`}
        accessibilityHint={expanded ? t('historyCloseEditor') : t('historyEditHint')}
        accessibilityState={{ expanded }}
        style={styles.rowHead}
      >
        <MedicationGlyph appearance={plan?.appearance} form={plan?.form} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>
            {dose.label}
          </Text>
          <Text style={[typography.subhead, { color: c.textSecondary }]}>{[time, detail].filter(Boolean).join(' · ')}</Text>
        </View>
        {pending ? (
          <ActivityIndicator size="small" color={c.textSecondary} accessibilityLabel={t('historyUpdating')} />
        ) : expanded ? (
          <View style={[styles.chevron, { backgroundColor: c.surfaceRaised }]}>
            <Ionicons name="chevron-up" size={20} color={c.textPrimary} />
          </View>
        ) : (
          <View>
            <Badge label={statusLabel} tone={meta.badge} icon={meta.icon} size="sm" />
          </View>
        )}
      </AnimatedPressable>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(motion.duration.base)} style={styles.editor}>
          <View
            pointerEvents={disabled ? 'none' : 'auto'}
            accessibilityState={{ disabled, busy: pending }}
            style={{ opacity: disabled ? 0.5 : 1 }}
          >
            <AnimatedSegmentedControl
              value={state}
              thumbColor={meta.thumb}
              onChange={(next) => onChangeState(next as CorrectionAction)}
              options={[
                { value: 'taken', label: t('statusTaken') },
                { value: 'skipped', label: t('statusSkipped') },
                { value: 'missed', label: t('statusMissed') },
              ]}
            />
          </View>

          {state === 'taken' && dose.eventTimestamp ? (
            <View style={styles.takenAt}>
              <Text style={[typography.callout, { color: c.textPrimary, fontFamily: font.semibold }]}>{t('takenAtLabel')}</Text>
              <View style={{ flex: 1 }}>
                <TimeField
                  mode="time"
                  value={clockOf(dose.eventTimestamp)}
                  onChange={onChangeTime}
                  accessibilityLabel={`${t('takenAtLabel')}, ${dose.label}`}
                />
              </View>
            </View>
          ) : null}

          {dose.eventId ? (
            <Button
              kind="destructive"
              size="sm"
              fullWidth={false}
              icon={<Ionicons name="trash-outline" size={16} color={c.tones.rose.fg} />}
              label={t('historyClearDoseLogCta')}
              onPress={onClear}
              disabled={disabled}
            />
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  reportPill: {
    minHeight: 48,
    borderRadius: radius.full,
    paddingLeft: spacing(3),
    paddingRight: spacing(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  hero: { borderRadius: radius.xxl, padding: spacing(5.5), gap: spacing(4) },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing(3) },
  pctRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroPct: { fontFamily: font.display, fontSize: 52, lineHeight: 58, letterSpacing: -1.6 },
  heroPctUnit: { fontFamily: font.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  trendChip: {
    minHeight: 34,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingLeft: spacing(2),
    paddingRight: spacing(3),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
  },
  statRow: { flexDirection: 'row', gap: spacing(2.5) },
  statCell: { flex: 1, minWidth: 0 },
  statTile: { borderRadius: radius.lg, padding: spacing(3.5), gap: spacing(0.5) },
  statNumber: { fontFamily: font.display, fontSize: 28, lineHeight: 33, letterSpacing: -0.6 },
  weekCard: { padding: spacing(5), gap: spacing(1) },
  weekLinkCard: { padding: 0 },
  weekLink: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), padding: spacing(4), minHeight: 64 },
  weekLinkIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { paddingHorizontal: spacing(1) },
  logRow: { borderRadius: radius.xl, borderWidth: 2, padding: spacing(3.5), gap: spacing(3.5) },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  chevron: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  editor: { gap: spacing(3.5) },
  takenAt: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  stateGlyph: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  missedList: { paddingHorizontal: spacing(4) },
  missedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(3), paddingVertical: spacing(3.5) },
  missedBody: { flex: 1, minWidth: 0, gap: spacing(2.5), alignItems: 'flex-start' },
  showAll: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1.5),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  calendar: { padding: spacing(4), gap: spacing(2) },
  monthHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingLeft: spacing(1) },
  monthArrow: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontVariant: ['tabular-nums'] },
  future: { opacity: 0.55 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing(4), rowGap: spacing(1.5), paddingHorizontal: spacing(1), paddingTop: spacing(1) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(2),
    gap: spacing(1),
  },
  handle: { width: 36, height: 4, borderRadius: radius.full, alignSelf: 'center', marginBottom: spacing(3) },
  sheetList: { marginTop: spacing(2), marginBottom: spacing(4) },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), minHeight: 60, paddingVertical: spacing(2) },
});
