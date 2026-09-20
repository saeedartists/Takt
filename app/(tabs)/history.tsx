import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedProgressBar,
  AnimatedSegmentedControl,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  SectionHeader,
  SkeletonCard,
  SkeletonRow,
  Stack,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { AdherenceBars, type AdherenceBarDay } from '@/components/ui/sparkline';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useRecordDose, useUndoDose } from '@/lib/hooks/use-takt-mutations';
import { TimeField } from '@/components/takt/time-field';
import { buildHistoryCsv } from '@/lib/takt/history-csv';
import { useLocale } from '@/lib/takt/l10n';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { buildHistory } from '@/lib/takt/schedule';
import { atClockTime, isoDateKey } from '@/lib/takt/time';
import type { DoseOccurrence, SkipReason } from '@/lib/takt/types';

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

const toStateBadgeTone = (state: CorrectionAction): 'success' | 'warning' | 'destructive' => {
  if (state === 'taken') return 'success';
  if (state === 'skipped') return 'warning';
  return 'destructive';
};

/** Eases the displayed integer toward `target`; snaps when duration is 0 (reduce motion). */
const useCountUp = (target: number, duration: number): number => {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    if (duration === 0 || from === target) {
      current.current = target;
      setValue(target);
      return;
    }
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      current.current = Math.round(from + (target - from) * eased);
      setValue(current.current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, target]);

  return value;
};

export default function HistoryScreen() {
  const { c } = useTokens();
  const { t, formatDate, formatTime, locale } = useLocale();
  const { duration } = useMotion();
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

  const shownPct = useCountUp(totals.adherencePct, duration.slow);
  // No thresholds, no traffic-light grading (brief §7, §12): the figure is a record, not a verdict.
  const pctColor = totals.denominator === 0 ? c.textTertiary : c.textPrimary;

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

  return (
    <PageShell>
      <PageHeader
        title={t('history')}
        subtitle={t('adherenceWindowDays').replace('{days}', windowDays.toString())}
        action={
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('openReport')}
            onPress={() => router.push('/report')}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minHeight: 44, justifyContent: 'center' })}
          >
            <Text style={[typography.subhead, { color: c.accent, fontWeight: '600' }]}>{t('report')}</Text>
          </Pressable>
        }
      />

      <Stack>
        <AnimatedSegmentedControl
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
            <Card>
              <View style={{ padding: spacing(4), gap: spacing(1) }}>
                <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('weeklySummaryTitle')}</Text>
                <Text style={[typography.headline, { color: c.textPrimary, fontVariant: ['tabular-nums'] }]}>
                  {t('weeklySummaryLine')
                    .replace('{taken}', String(weekly.thisWeek.taken))
                    .replace('{total}', String(weekly.thisWeek.total))}
                </Text>
                <Text style={[typography.footnote, { color: c.textTertiary, fontVariant: ['tabular-nums'] }]}>
                  {t('weeklySummaryLastWeek')
                    .replace('{taken}', String(weekly.lastWeek.taken))
                    .replace('{total}', String(weekly.lastWeek.total))}
                </Text>
              </View>
            </Card>

            <View>
              <SectionHeader
                title={t('adherenceTrend')}
                action={
                  <Button
                    kind="secondary"
                    size="sm"
                    label={t('exportCsv')}
                    onPress={() => void exportCsv()}
                    loading={exportingCsv}
                    disabled={isLoading}
                  />
                }
              />
            <Card>
              <View style={{ padding: spacing(4), gap: spacing(3) }}>
                <View style={styles.metricRow}>
                  <Text
                    accessibilityLabel={`${totals.adherencePct.toString()}% ${t('takenOnSchedule')}`}
                    style={[typography.metricSm, { color: pctColor, fontVariant: ['tabular-nums'] }]}
                  >
                    {`${shownPct.toString()}%`}
                  </Text>
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('takenOnSchedule')}</Text>
                </View>

                <AnimatedProgressBar
                  progress={Math.min(1, Math.max(0, totals.adherencePct / 100))}
                  color={c.accent}
                  height={8}
                />

                <AdherenceBars
                  days={barDays}
                  height={72}
                  accessibilityLabel={`${t('adherenceTrend')} · ${t('adherenceWindowDays').replace('{days}', windowDays.toString())}`}
                />
                {totals.denominator > 0 ? (
                  <View style={{ flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' }}>
                    <Badge label={`${totals.taken.toString()} ${t('statusTaken')}`} tone="success" />
                    {totals.skipped > 0 ? (
                      <Badge label={`${totals.skipped.toString()} ${t('statusSkipped')}`} tone="warning" />
                    ) : null}
                    {totals.missed > 0 ? (
                      <Badge label={`${totals.missed.toString()} ${t('statusMissed')}`} tone="destructive" />
                    ) : null}
                  </View>
                ) : (
                  <Text style={[typography.footnote, { color: c.textTertiary }]}>{t('reportNoDataInWindow')}</Text>
                )}
              </View>
            </Card>
            {exportNote ? (
              <Text
                accessibilityRole={exportNote.tone === 'error' ? 'alert' : undefined}
                style={[
                  typography.footnote,
                  styles.dayLabel,
                  { marginTop: spacing(2), color: exportNote.tone === 'error' ? c.destructive : c.textSecondary },
                ]}
              >
                {exportNote.text}
              </Text>
            ) : null}
            </View>

            <View>
              <SectionHeader title={t('historyFixLogSectionTitle')} />
              {correctionGroups.length === 0 ? (
                <EmptyState title={t('historyFixLogEmptyTitle')} description={t('historyFixLogEmptyHint')} />
              ) : (
                <Stack>
                  {correctionGroups.map((group) => (
                    <View key={group.dayLabel} style={{ gap: spacing(2.5) }}>
                      <Text
                        accessibilityRole="header"
                        style={[typography.overline, styles.dayLabel, { color: c.textSecondary }]}
                      >
                        {group.dayLabel}
                      </Text>
                      {group.rows.map((dose) => {
                        const state = dose.state as CorrectionAction;
                        const pending = pendingDoseId === dose.id;
                        const disabled = pending || recordDose.isPending || undoDose.isPending;

                        const stateIcon = state === 'taken' ? 'checkmark' : state === 'skipped' ? 'pause' : 'alert';
                        const stateColor = state === 'taken' ? c.success : state === 'skipped' ? c.warning : c.destructive;

                        return (
                          <Card key={dose.id}>
                            <View style={{ padding: spacing(4), gap: spacing(3) }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(3) }}>
                                <View
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: radius.md,
                                    backgroundColor: `${stateColor}1A`,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Ionicons name={stateIcon} size={16} color={stateColor} />
                                </View>

                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={[typography.headline, { color: c.textPrimary }]} numberOfLines={1}>
                                    {dose.label}
                                  </Text>
                                  <Text style={[typography.footnote, { color: c.textSecondary, marginTop: 1 }]}>
                                    {[formatTime(dose.scheduledAt), dose.reasonCode ? t(reasonKey(dose.reasonCode)) : null]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </Text>
                                </View>

                                {pending ? (
                                  <ActivityIndicator size="small" color={c.textSecondary} accessibilityLabel={t('historyUpdating')} />
                                ) : (
                                  <Badge
                                    label={
                                      state === 'taken'
                                        ? t('statusTaken')
                                        : state === 'skipped'
                                          ? t('statusSkipped')
                                          : t('statusMissed')
                                    }
                                    tone={toStateBadgeTone(state)}
                                  />
                                )}
                              </View>

                              <View
                                pointerEvents={disabled ? 'none' : 'auto'}
                                accessibilityState={{ disabled, busy: pending }}
                                style={{ opacity: disabled ? 0.5 : 1 }}
                              >
                                <AnimatedSegmentedControl
                                  value={state}
                                  onChange={(next) => void rewriteDoseState(dose, next as CorrectionAction)}
                                  options={[
                                    { value: 'taken', label: t('statusTaken') },
                                    { value: 'skipped', label: t('statusSkipped') },
                                    { value: 'missed', label: t('statusMissed') },
                                  ]}
                                />
                              </View>

                              {state === 'taken' && dose.eventTimestamp ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(3) }}>
                                  <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('takenAtLabel')}</Text>
                                  <View style={{ flex: 1 }}>
                                    <TimeField
                                      mode="time"
                                      value={clockOf(dose.eventTimestamp)}
                                      onChange={(next) =>
                                        void rewriteDoseState(dose, 'taken', atClockTime(dose.scheduledAt, next))
                                      }
                                      accessibilityLabel={`${t('takenAtLabel')}, ${dose.label}`}
                                    />
                                  </View>
                                </View>
                              ) : null}

                              {dose.eventId ? (
                                <View style={{ flexDirection: 'row' }}>
                                  <Button
                                    kind="secondary"
                                    size="sm"
                                    icon={<Ionicons name="trash-outline" size={15} color={c.textSecondary} />}
                                    label={t('historyClearDoseLogCta')}
                                    onPress={() => void clearDoseLog(dose)}
                                    disabled={disabled}
                                  />
                                </View>
                              ) : null}
                            </View>
                          </Card>
                        );
                      })}
                    </View>
                  ))}
                </Stack>
              )}
            </View>

            {totals.denominator === 0 ? null : (
            <View>
              <SectionHeader title={t('missedDoses')} />
              {missed.length === 0 ? (
                <EmptyState title={t('allCaughtUp')} description={t('greatRhythm')} />
              ) : (
                <Stack>
                  {missed.map((item) => (
                    <Card key={item.id}>
                      <View style={{ padding: spacing(4), gap: spacing(2.5) }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) }}>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: radius.md,
                              backgroundColor: `${c.destructive}1A`,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="alert" size={16} color={c.destructive} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[typography.body, { color: c.textPrimary }]}>{item.title}</Text>
                            <Text style={[typography.footnote, { color: c.textSecondary }]}>{item.subtitle}</Text>
                          </View>
                        </View>

                        <Button
                          kind="secondary"
                          label={t('markTakenFromHistory')}
                          onPress={() => void markTaken(item)}
                          disabled={recordDose.isPending || undoDose.isPending}
                        />
                      </View>
                    </Card>
                  ))}
                </Stack>
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
    </PageShell>
  );
}

const styles = {
  metricRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing(2),
  },
  dayLabel: {
    paddingHorizontal: spacing(1),
  },
};
