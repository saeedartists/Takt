import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedNumber,
  AnimatedPressable,
  AnimatedSegmentedControl,
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
import { buildHistoryCsv } from '@/lib/takt/history-csv';
import { useLocale } from '@/lib/takt/l10n';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { buildHistory, type HistoryDay } from '@/lib/takt/schedule';
import { atClockTime, isoDateKey, startOfDay } from '@/lib/takt/time';
import type { DoseOccurrence, MedicationPlan } from '@/lib/takt/types';
import { semantic } from '@/theme/tokens';

import { DaySheet } from '@/components/takt/history/_day-sheet';
import { DoseLogRow } from '@/components/takt/history/_dose-log-row';
import { MonthCalendar } from '@/components/takt/history/_month-calendar';
import {
  historyLayoutGlide,
  STATE_META,
  type CorrectionAction,
  type DoseWithDay,
} from '@/components/takt/history/_history-shared';

type Note = { tone: 'success' | 'error'; text: string };

/** Missed doses shown before "Show all": the newest few are the ones worth fixing. */
const MISSED_PREVIEW = 4;

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
              quantity: dose.quantity,
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
        await undoDose.mutateAsync({
          eventId: dose.eventId,
          medicationRef: dose.medicationRef,
          taken: dose.state === 'taken',
          quantity: dose.quantity,
        });
      }

      await recordDose.mutateAsync({
        patientRef,
        medicationRef: dose.medicationRef,
        requestRef: `MedicationRequest/${dose.requestId}`,
        scheduledAt: dose.scheduledAt,
        action,
        effectiveAt,
        quantity: dose.quantity,
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
      await undoDose.mutateAsync({
        eventId: dose.eventId,
        medicationRef: dose.medicationRef,
        taken: dose.state === 'taken',
        quantity: dose.quantity,
      });
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
        await undoDose.mutateAsync({
          eventId: item.eventId,
          medicationRef: item.medicationRef,
          quantity: item.quantity,
        });
      }

      await recordDose.mutateAsync({
        patientRef,
        medicationRef: item.medicationRef,
        requestRef: `MedicationRequest/${item.requestId}`,
        scheduledAt: item.scheduledAt,
        action: 'taken',
        quantity: item.quantity,
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
                      layout={historyLayoutGlide}
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
                        layout={historyLayoutGlide}
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
});
