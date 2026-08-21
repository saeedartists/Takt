import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PageShell,
  SectionHeader,
  Stack,
  categoryColors,
  MIN_TOUCH_TARGET,
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
import { adherenceSummary, buildDoseOccurrencesForDay, doseSubtitle, upcomingCount } from '@/lib/takt/schedule';
import { useLocale } from '@/lib/takt/l10n';
import { scheduleSnoozeReminder } from '@/lib/takt/reminders';
import { startOfDay } from '@/lib/takt/time';
import type { DoseOccurrence, DoseState } from '@/lib/takt/types';

const canUndo = (dose: DoseOccurrence): boolean => {
  if (!dose.eventId || !dose.eventTimestamp) return false;
  if (!['taken', 'skipped'].includes(dose.state)) return false;
  const ageMs = Date.now() - new Date(dose.eventTimestamp).getTime();
  return ageMs <= 10 * 60 * 1000;
};

const stateTone = (state: DoseState): 'neutral' | 'accent' | 'success' | 'warning' | 'destructive' => {
  if (state === 'taken') return 'success';
  if (state === 'due') return 'warning';
  if (state === 'missed') return 'destructive';
  if (state === 'skipped') return 'warning';
  return 'neutral';
};

export default function TodayScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t, formatDate, formatTime } = useLocale();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;

  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const recordDose = useRecordDose();
  const undoDose = useUndoDose();
  const reminderPrefs = useReminderPreferences();
  const autoMarkedMissed = useRef<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const todayDoses = useMemo(
    () =>
      buildDoseOccurrencesForDay(
        plans.plans,
        (events.data?.entry ?? []).map((x) => x.resource),
        startOfDay(new Date()),
        new Date(),
      ),
    [events.data?.entry, plans.plans],
  );

  const summary = adherenceSummary(todayDoses);
  const toCome = upcomingCount(todayDoses);
  const dueNow = todayDoses.filter((dose) => dose.state === 'due').length;

  const nextActionDose = useMemo(
    () => todayDoses.find((dose) => dose.state === 'due') ?? todayDoses.find((dose) => dose.state === 'scheduled') ?? null,
    [todayDoses],
  );

  const completionPct =
    todayDoses.length > 0
      ? Math.round((todayDoses.filter((dose) => dose.state === 'taken').length / todayDoses.length) * 100)
      : 0;
  const completionWidth = `${completionPct}%` as `${number}%`;

  const grouped = useMemo(() => {
    const buckets = new Map<string, DoseOccurrence[]>();
    for (const dose of todayDoses) {
      const key = formatTime(dose.scheduledAt);
      const list = buckets.get(key) ?? [];
      list.push(dose);
      buckets.set(key, list);
    }
    return [...buckets.entries()].map(([time, doses]) => ({ time, doses }));
  }, [formatTime, todayDoses]);

  useEffect(() => {
    if (!patientRef) return;

    const missedToPersist = todayDoses.filter(
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
  }, [patientRef, recordDose, todayDoses]);

  const takeAction = async (dose: DoseOccurrence, action: 'taken' | 'skipped') => {
    if (!patientRef) return;
    setActionError(null);

    try {
      await recordDose.mutateAsync({
        patientRef,
        medicationRef: dose.medicationRef,
        requestRef: `MedicationRequest/${dose.requestId}`,
        scheduledAt: dose.scheduledAt,
        action,
      });
    } catch {
      setActionError(t('doseActionError'));
    }
  };

  const snoozeDose = async (dose: DoseOccurrence) => {
    setActionError(null);

    try {
      await scheduleSnoozeReminder(dose.label, reminderPrefs.data?.snoozeMinutes ?? 15, {
        title: t('doseSnoozedTitle'),
        body: t('doseSnoozedBody'),
      });
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

  return (
    <PageShell>
      <PageHeader
        title={t('today')}
        subtitle={formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}
        action={
          <Link href="/report" asChild>
            <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Text style={[typography.subhead, { color: c.accent }]}>{t('report')}</Text>
            </Pressable>
          </Link>
        }
      />

      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.headline, { color: c.textSecondary }]}>{t('rhythmToday')}</Text>

            <View style={styles.summaryRow}>
              <View style={{ gap: spacing(1) }}>
                <Text
                  style={[
                    typography.metricSm,
                    {
                      color: categoryColors.medication,
                      fontVariant: ['tabular-nums'],
                    },
                  ]}
                >
                  {`${summary.taken}/${todayDoses.length}`}
                </Text>
                <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('takenToday')}</Text>
              </View>
              <Badge label={`${completionPct.toString()}% ${t('completion')}`} tone="accent" />
            </View>

            <View style={[styles.progressTrack, { backgroundColor: c.surfaceRaised }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: completionWidth,
                    backgroundColor: categoryColors.medication,
                  },
                ]}
              />
            </View>

            <View style={styles.chipsRow}>
              <Badge label={`${dueNow.toString()} ${t('dueNow')}`} tone="warning" />
              <Badge label={`${toCome.toString()} ${t('toCome')}`} tone="neutral" />
              <Badge label={`${summary.denominator.toString()} ${t('logged')}`} tone="success" />
            </View>

            {nextActionDose ? (
              <View style={[styles.focusCard, { backgroundColor: c.surfaceRaised, borderColor: c.separator }]}>
                <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('nextDose')}</Text>
                <Text numberOfLines={1} style={[typography.headline, { color: c.textPrimary }]}>
                  {nextActionDose.label}
                </Text>
                <Text style={[typography.subhead, { color: c.textSecondary }]}>{doseSubtitle(nextActionDose)}</Text>
                <Button
                  label={t('confirmTaken')}
                  onPress={() => void takeAction(nextActionDose, 'taken')}
                  disabled={nextActionDose.state !== 'due' || recordDose.isPending}
                />
              </View>
            ) : null}

            {actionError ? <Text style={[typography.footnote, { color: c.destructive }]}>{actionError}</Text> : null}
          </View>
        </Card>

        <View>
          <SectionHeader
            title={t('timeline')}
            action={<Button kind="secondary" label={t('addMedication')} onPress={() => router.push('/medications/new')} />}
          />
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
              title={t('noDosesToday')}
              description={t('addMedicationHint')}
              action={<Button label={t('addMedication')} onPress={() => router.push('/medications/new')} />}
            />
          ) : (
            <Stack>
              {grouped.map((bucket) => (
                <Card key={bucket.time}>
                  <View style={{ overflow: 'hidden', borderRadius: radius.lg }}>
                    <View style={styles.timeHeader}>
                      <Text style={[typography.headline, { color: c.textPrimary }]}>{bucket.time}</Text>
                    </View>
                    {bucket.doses.map((dose, index) => (
                      <View
                        key={dose.id}
                        style={[
                          styles.row,
                          index > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: c.separator,
                          },
                        ]}
                      >
                        <View style={[styles.rowRail, { backgroundColor: railColor(dose.state, c) }]} />

                        <View style={{ flex: 1, minWidth: 0, gap: spacing(2) }}>
                          <View style={{ gap: spacing(1) }}>
                            <Text numberOfLines={1} style={[typography.body, { color: c.textPrimary }]}>
                              {dose.label}
                            </Text>
                            <Text style={[typography.footnote, { color: c.textSecondary }]}>
                              {doseSubtitle(dose)}
                            </Text>
                          </View>

                          <Badge label={stateLabel(dose.state)} tone={stateTone(dose.state)} />

                          {dose.state === 'due' ? (
                            <View style={{ gap: spacing(2) }}>
                              <Button
                                label={t('confirmTaken')}
                                onPress={() => void takeAction(dose, 'taken')}
                                disabled={recordDose.isPending}
                              />
                              <View style={styles.actionRow}>
                                <ActionPill
                                  label={t('markSkipped')}
                                  color={c.warning}
                                  onPress={() => void takeAction(dose, 'skipped')}
                                  disabled={recordDose.isPending}
                                />
                                <ActionPill
                                  label={`${t('snooze')} ${reminderPrefs.data?.snoozeMinutes ?? 15}m`}
                                  color={c.accent}
                                  onPress={() => void snoozeDose(dose)}
                                  disabled={recordDose.isPending || reminderPrefs.isLoading}
                                />
                              </View>
                            </View>
                          ) : null}

                          {canUndo(dose) ? (
                            <ActionPill
                              label={t('undo')}
                              color={c.accent}
                              onPress={() => void undoDose.mutateAsync(dose.eventId!).catch(() => setActionError(t('undoDoseError')))}
                              disabled={undoDose.isPending}
                            />
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              ))}
            </Stack>
          )}
        </View>
      </Stack>
    </PageShell>
  );
}

const railColor = (state: DoseState, colors: ReturnType<typeof useTokens>['c']): string => {
  if (state === 'taken') return colors.success;
  if (state === 'due') return colors.warning;
  if (state === 'missed') return colors.destructive;
  if (state === 'skipped') return colors.warning;
  return colors.separator;
};

const ActionPill = ({
  label,
  color,
  onPress,
  disabled,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.action,
      {
        backgroundColor: `${color}1F`,
        borderColor: `${color}44`,
        opacity: disabled ? 0.45 : pressed ? 0.62 : 1,
      },
    ]}
  >
    <Text style={[typography.footnote, { color, fontWeight: '600' }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(3),
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing(2),
    flexWrap: 'wrap',
  },
  focusCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing(3),
    gap: spacing(2),
  },
  timeHeader: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(2),
  },
  row: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    gap: spacing(3),
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowRail: {
    width: 4,
    borderRadius: radius.full,
    minHeight: 52,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing(2),
    flexWrap: 'wrap',
  },
  action: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: spacing(2.5),
  },
});
