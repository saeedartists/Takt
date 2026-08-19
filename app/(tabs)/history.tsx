import { useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  LoadingState,
  PageHeader,
  PageShell,
  SectionHeader,
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
import { useLocale } from '@/lib/takt/l10n';
import { buildHistory } from '@/lib/takt/schedule';
import { formatShortDate } from '@/lib/takt/time';

export default function HistoryScreen() {
  const { c } = useTokens();
  const { t } = useLocale();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);

  const history = useMemo(
    () => buildHistory(plans.plans, (events.data?.entry ?? []).map((x) => x.resource), 14),
    [events.data?.entry, plans.plans],
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
              subtitle: `${formatShortDate(day.date)} · ${dose.scheduledAt.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`,
            })),
        )
        .slice(0, 30),
    [history],
  );

  return (
    <PageShell>
      <PageHeader title={t('history')} subtitle={t('adherenceWindow')} />

      <Stack>
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
              <SectionHeader title={t('missedDoses')} />
              {missed.length === 0 ? (
                <EmptyState title={t('allCaughtUp')} description={t('greatRhythm')} />
              ) : (
                <ListGroup>
                  {missed.map((item, index) => (
                    <ListRow key={item.id} isFirst={index === 0} title={item.title} subtitle={item.subtitle} />
                  ))}
                </ListGroup>
              )}
            </View>
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
