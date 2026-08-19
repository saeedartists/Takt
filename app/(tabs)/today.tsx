import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
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
import { buildDoseOccurrencesForDay, adherenceSummary, doseSubtitle, upcomingCount } from '@/lib/takt/schedule';
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
  const { t } = useLocale();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;

  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const recordDose = useRecordDose();
  const undoDose = useUndoDose();
  const autoMarkedMissed = useRef<Set<string>>(new Set());

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
  const completionPct =
    todayDoses.length > 0
      ? Math.round((todayDoses.filter((dose) => dose.state === 'taken').length / todayDoses.length) * 100)
      : 0;
  const completionWidth = `${completionPct}%` as `${number}%`;

  const grouped = useMemo(() => {
    const buckets = new Map<string, DoseOccurrence[]>();
    for (const dose of todayDoses) {
      const key = dose.scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const list = buckets.get(key) ?? [];
      list.push(dose);
      buckets.set(key, list);
    }
    return [...buckets.entries()].map(([time, doses]) => ({ time, doses }));
  }, [todayDoses]);

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
    await recordDose.mutateAsync({
      patientRef,
      medicationRef: dose.medicationRef,
      requestRef: `MedicationRequest/${dose.requestId}`,
      scheduledAt: dose.scheduledAt,
      action,
    });
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
        subtitle={new Date().toLocaleDateString()}
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
          </View>
        </Card>

        <View>
          <SectionHeader title={t('today')} />
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
                        <View style={{ flex: 1, minWidth: 0, gap: spacing(1.5) }}>
                          <Text numberOfLines={1} style={[typography.body, { color: c.textPrimary }]}>
                            {dose.label}
                          </Text>
                          <Text style={[typography.footnote, { color: c.textSecondary }]}>
                            {doseSubtitle(dose)}
                          </Text>
                          <Badge label={stateLabel(dose.state)} tone={stateTone(dose.state)} />
                        </View>

                        {(dose.state === 'due' || dose.state === 'scheduled') && (
                          <View style={styles.actionColumn}>
                            <ActionPill
                              label={t('confirmTaken')}
                              color={categoryColors.medication}
                              onPress={() => void takeAction(dose, 'taken')}
                            />
                            <ActionPill
                              label={t('markSkipped')}
                              color={c.warning}
                              onPress={() => void takeAction(dose, 'skipped')}
                            />
                            <ActionPill
                              label={t('snooze')}
                              color={c.accent}
                              onPress={() => void scheduleSnoozeReminder(dose.label)}
                            />
                          </View>
                        )}

                        {canUndo(dose) && (
                          <ActionPill
                            label={t('undo')}
                            color={c.accent}
                            onPress={() => void undoDose.mutateAsync(dose.eventId!)}
                          />
                        )}
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

const ActionPill = ({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => [
      styles.action,
      {
        backgroundColor: `${color}1F`,
        borderColor: `${color}44`,
        opacity: pressed ? 0.62 : 1,
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
  timeHeader: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(2),
  },
  row: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    gap: spacing(2),
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  actionColumn: {
    gap: spacing(1.5),
    alignItems: 'flex-end',
  },
  action: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: spacing(2.5),
  },
});
