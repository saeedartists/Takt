import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
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
  SegmentedControl,
  Sparkline,
  Stack,
  categoryColors,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useRecordDose, useUndoDose } from '@/lib/hooks/use-takt-mutations';
import { useLocale } from '@/lib/takt/l10n';
import { buildHistory } from '@/lib/takt/schedule';
import type { DoseOccurrence } from '@/lib/takt/types';

type CorrectionAction = 'taken' | 'skipped' | 'missed';
type DoseWithDay = DoseOccurrence & { dayLabel: string };

const toStateBadgeTone = (state: CorrectionAction): 'success' | 'warning' | 'destructive' => {
  if (state === 'taken') return 'success';
  if (state === 'skipped') return 'warning';
  return 'destructive';
};

export default function HistoryScreen() {
  const { c } = useTokens();
  const { t, formatDate, formatTime } = useLocale();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const recordDose = useRecordDose();
  const undoDose = useUndoDose();
  const [actionError, setActionError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(14);
  const [pendingDoseId, setPendingDoseId] = useState<string | null>(null);

  const history = useMemo(
    () => buildHistory(plans.plans, (events.data?.entry ?? []).map((x) => x.resource), windowDays),
    [events.data?.entry, plans.plans, windowDays],
  );

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

  const trend = useMemo(() => history.map((day) => day.adherencePct), [history]);

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
              dayLabel: formatDate(day.date, { month: 'short', day: 'numeric' }),
            })),
        )
        .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
        .slice(0, 12),
    [formatDate, history],
  );

  const rewriteDoseState = async (dose: DoseWithDay, action: CorrectionAction) => {
    if (!patientRef) return;

    if (dose.state === action && dose.eventId) {
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

  return (
    <PageShell>
      <PageHeader
        title={t('history')}
        subtitle={t('adherenceWindowDays').replace('{days}', windowDays.toString())}
      />

      <Stack>
        <Card>
          <View style={{ padding: spacing(3), gap: spacing(2) }}>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('historyWindowLabel')}</Text>
            <SegmentedControl
              value={windowDays.toString()}
              onChange={(next) => setWindowDays(Number.parseInt(next, 10) as 7 | 14 | 30)}
              options={[
                { value: '7', label: t('historyWindow7') },
                { value: '14', label: t('historyWindow14') },
                { value: '30', label: t('historyWindow30') },
              ]}
            />
          </View>
        </Card>

        {patient.isLoading || plans.isLoading || events.isLoading ? (
          <LoadingState label={t('loadingHistory')} />
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
              <View style={{ padding: spacing(4), gap: spacing(3) }}>
                <Text style={[typography.headline, { color: c.textSecondary }]}>{t('adherenceTrend')}</Text>
                <View style={styles.metricRow}>
                  <Text
                    style={[
                      typography.metricSm,
                      {
                        color: categoryColors.medication,
                        fontVariant: ['tabular-nums'],
                      },
                    ]}
                  >
                    {`${totals.adherencePct.toString()}%`}
                  </Text>
                  <Badge label={t('takenOnSchedule')} tone="accent" />
                </View>
                <Sparkline values={trend} category="medication" height={72} />
                <View style={{ flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' }}>
                  <Badge label={`${totals.taken.toString()} ${t('statusTaken')}`} tone="success" />
                  <Badge label={`${totals.skipped.toString()} ${t('statusSkipped')}`} tone="warning" />
                  <Badge label={`${totals.missed.toString()} ${t('statusMissed')}`} tone="destructive" />
                </View>
              </View>
            </Card>

            <View>
              <SectionHeader title={t('historyFixLogSectionTitle')} />
              {correctionRows.length === 0 ? (
                <EmptyState title={t('historyFixLogEmptyTitle')} description={t('historyFixLogEmptyHint')} />
              ) : (
                <Stack>
                  {correctionRows.map((dose) => {
                    const state = dose.state as CorrectionAction;
                    const disabled = pendingDoseId === dose.id || recordDose.isPending || undoDose.isPending;
                    const dateTimeLabel = `${dose.dayLabel} · ${formatTime(dose.scheduledAt)}`;

                    return (
                      <Card key={dose.id}>
                        <View style={{ padding: spacing(4), gap: spacing(2.5) }}>
                          <View style={styles.metricRow}>
                            <Text style={[typography.body, { color: c.textPrimary, flex: 1 }]}>{dose.label}</Text>
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
                          </View>

                          <Text style={[typography.footnote, { color: c.textSecondary }]}>{dateTimeLabel}</Text>

                          <SegmentedControl
                            value={state}
                            onChange={(next) => void rewriteDoseState(dose, next as CorrectionAction)}
                            options={[
                              { value: 'taken', label: t('statusTaken') },
                              { value: 'skipped', label: t('statusSkipped') },
                              { value: 'missed', label: t('statusMissed') },
                            ]}
                          />

                          {dose.eventId ? (
                            <Button
                              kind="secondary"
                              label={t('historyClearDoseLogCta')}
                              onPress={() => void clearDoseLog(dose)}
                              disabled={disabled}
                            />
                          ) : null}
                        </View>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </View>

            <View>
              <SectionHeader title={t('missedDoses')} />
              {missed.length === 0 ? (
                <EmptyState title={t('allCaughtUp')} description={t('greatRhythm')} />
              ) : (
                <Stack>
                  {missed.map((item) => (
                    <Card key={item.id}>
                      <View style={{ padding: spacing(4), gap: spacing(2.5) }}>
                        <Text style={[typography.body, { color: c.textPrimary }]}>{item.title}</Text>
                        <Text style={[typography.footnote, { color: c.textSecondary }]}>{item.subtitle}</Text>
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

            {actionError ? <Text style={[typography.footnote, { color: c.destructive }]}>{actionError}</Text> : null}
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
};
