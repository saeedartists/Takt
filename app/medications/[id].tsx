import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  LoadingState,
  PageHeader,
  PageShell,
  SectionHeader,
  Stack,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useUpdateMedicationPlan } from '@/lib/hooks/use-takt-mutations';
import { TAKT_EXT } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { getDaysUntilRefill, getLastRefilledAt, getSupplyCount } from '@/lib/takt/supply-tracker';

const statusTone = (status: string): 'success' | 'warning' | 'destructive' => {
  if (status === 'on-hold') return 'warning';
  if (status === 'stopped') return 'destructive';
  return 'success';
};

const statusLabelKey = (status: string): 'statusActive' | 'statusPaused' | 'statusArchived' => {
  if (status === 'on-hold') return 'statusPaused';
  if (status === 'stopped') return 'statusArchived';
  return 'statusActive';
};

const cadenceLabelKey = (
  cadence: 'daily' | 'weekdays' | 'custom',
): 'cadenceDaily' | 'cadenceWeekdays' | 'cadenceSpecificDays' => {
  if (cadence === 'weekdays') return 'cadenceWeekdays';
  if (cadence === 'custom') return 'cadenceSpecificDays';
  return 'cadenceDaily';
};

export default function MedicationDetailsScreen() {
  const { c } = useTokens();
  const { t, formatDateTime } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const updatePlan = useUpdateMedicationPlan();

  const plan = useMemo(() => plans.plans.find((entry) => entry.request.id === id), [id, plans.plans]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [supplyCount, setSupplyCountState] = useState<number | null>(null);
  const [daysUntilRefill, setDaysUntilRefill] = useState<number | null>(null);
  const [lastRefilledAt, setLastRefilledAtState] = useState<string | null>(null);

  const reloadSupply = useCallback(async () => {
    const medicationId = plan?.medication?.id;
    if (!medicationId) {
      setSupplyCountState(null);
      setDaysUntilRefill(null);
      setLastRefilledAtState(null);
      return;
    }

    const [count, days, refilledAt] = await Promise.all([
      getSupplyCount(medicationId),
      getDaysUntilRefill(medicationId),
      getLastRefilledAt(medicationId),
    ]);

    setSupplyCountState(count);
    setDaysUntilRefill(days);
    setLastRefilledAtState(refilledAt);
  }, [plan?.medication?.id]);

  useFocusEffect(
    useCallback(() => {
      void reloadSupply();
    }, [reloadSupply]),
  );

  const relatedEvents = useMemo(() => {
    if (!plan) return [];
    return (events.data?.entry ?? [])
      .map((entry) => entry.resource)
      .filter((entry) => entry.request?.reference === `MedicationRequest/${plan.request.id}`)
      .slice(0, 8);
  }, [events.data?.entry, plan]);

  if (patient.isLoading || plans.isLoading || events.isLoading) {
    return (
      <PageShell>
        <LoadingState label={t('loadingMedication')} />
      </PageShell>
    );
  }

  if (patient.error || plans.error || events.error) {
    return (
      <PageShell>
        <ErrorState
          description={t('loadMedicationsError')}
          onRetry={() => {
            void patient.refetch();
            void plans.requestsQuery.refetch();
            void plans.medicationsQuery.refetch();
            void events.refetch();
            void reloadSupply();
          }}
        />
      </PageShell>
    );
  }

  if (!plan || !patientRef || !plan.medication) {
    return (
      <PageShell>
        <EmptyState title={t('medicationNotFound')} description={t('medicationNotFoundHint')} />
      </PageShell>
    );
  }

  const medication = plan.medication;

  const updateStatus = async (nextStatus: 'active' | 'on-hold' | 'stopped') => {
    setStatusError(null);

    try {
      await updatePlan.mutateAsync({
        patientRef,
        name: plan.label,
        form: plan.form,
        strength: plan.strength,
        cadence: plan.cadence,
        dayOfWeek: plan.dayOfWeek,
        times: plan.times,
        supplyCount: supplyCount ?? undefined,
        status: nextStatus,
        request: plan.request,
        medication,
      });
    } catch {
      setStatusError(t('medicationStatusActionError'));
    }
  };

  return (
    <PageShell>
      <PageHeader title={plan.label} subtitle={t('medicationDetailsSubtitle')} />

      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <View style={{ flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' }}>
              <Badge label={t(statusLabelKey(plan.request.status))} tone={statusTone(plan.request.status)} />
              <Badge label={t(cadenceLabelKey(plan.cadence))} tone="accent" />
            </View>

            <ListGroup>
              <ListRow isFirst title={t('medicationForm')} value={plan.form || t('formNotSet')} />
              <ListRow title={t('medicationStrength')} value={plan.strength || '—'} />
              <ListRow title={t('medicationTimes')} value={plan.times.join(', ')} />
            </ListGroup>

            <Button label={t('editMedicationPlanCta')} onPress={() => router.push(`/medications/${plan.request.id}/edit`)} />
          </View>
        </Card>

        <View>
          <SectionHeader title={t('medicationSupplySectionTitle')} />
          <Card>
            <View style={{ padding: spacing(4) }}>
              <ListGroup>
                <ListRow
                  isFirst
                  title={t('medicationSupply')}
                  value={typeof supplyCount === 'number' ? supplyCount.toString() : '—'}
                />
                <ListRow
                  title={t('supplyDaysUntilRefill')}
                  value={typeof daysUntilRefill === 'number' ? daysUntilRefill.toString() : '—'}
                />
                <ListRow
                  title={t('supplyLastRefilled')}
                  value={
                    lastRefilledAt
                      ? formatDateTime(new Date(lastRefilledAt), {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'
                  }
                />
              </ListGroup>
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title={t('medicationFlowActionsTitle')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(2.5) }}>
              {plan.request.status === 'active' ? (
                <Button
                  kind="secondary"
                  label={t('pauseMedicationCta')}
                  onPress={() => void updateStatus('on-hold')}
                  disabled={updatePlan.isPending}
                />
              ) : null}

              {plan.request.status === 'on-hold' ? (
                <Button
                  kind="secondary"
                  label={t('resumeMedicationCta')}
                  onPress={() => void updateStatus('active')}
                  disabled={updatePlan.isPending}
                />
              ) : null}

              {plan.request.status !== 'stopped' ? (
                <Button
                  kind="destructive"
                  label={t('archiveMedicationCta')}
                  onPress={() => void updateStatus('stopped')}
                  disabled={updatePlan.isPending}
                />
              ) : null}

              <Button
                kind="secondary"
                label={t('openTodayTimelineCta')}
                onPress={() => router.push('/(tabs)/today')}
              />

              {statusError ? <Text style={[typography.footnote, { color: c.destructive }]}>{statusError}</Text> : null}
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title={t('recentDoseLogsTitle')} />
          {relatedEvents.length === 0 ? (
            <EmptyState title={t('noDoseLogsYetTitle')} description={t('noDoseLogsYetHint')} />
          ) : (
            <ListGroup>
              {relatedEvents.map((event, index) => {
                const scheduledAt = event.extension?.find((entry) => entry.url === TAKT_EXT.scheduledTime)?.valueDateTime;
                const effectiveAt = event.effectiveDateTime;

                const actionLabel =
                  event.status === 'completed'
                    ? t('statusTaken')
                    : event.statusReason?.[0]?.coding?.[0]?.code === 'patient-refusal'
                      ? t('statusSkipped')
                      : t('statusMissed');

                const timestamp = scheduledAt ?? effectiveAt;
                const subtitle = timestamp
                  ? `${actionLabel} · ${formatDateTime(new Date(timestamp))}`
                  : actionLabel;

                return <ListRow key={event.id} isFirst={index === 0} title={plan.label} subtitle={subtitle} />;
              })}
            </ListGroup>
          )}
        </View>
      </Stack>
    </PageShell>
  );
}
