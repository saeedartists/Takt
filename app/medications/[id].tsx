import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedProgressBar,
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
  radius,
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
import {
  getDaysUntilRefill,
  getLastRefilledAt,
  getSupplyCount,
  setSupplyCount,
} from '@/lib/takt/supply-tracker';

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

  const [quickRefilling, setQuickRefilling] = useState(false);

  const handleQuickRefill = async (amount: number = 30) => {
    const medicationId = plan?.medication?.id;
    if (!medicationId) return;
    setQuickRefilling(true);
    try {
      const current = supplyCount ?? 0;
      const next = current + amount;
      await setSupplyCount(medicationId, next);
      await reloadSupply();
    } finally {
      setQuickRefilling(false);
    }
  };

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
        {/* Visual Hero Card */}
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3.5) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(3) }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.lg,
                  backgroundColor: `${c.accent}1A`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: `${c.accent}33`,
                }}
              >
                <Ionicons name="medkit" size={26} color={c.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.title2, { color: c.textPrimary }]} numberOfLines={2}>
                  {plan.label}
                </Text>
                <Text style={[typography.subhead, { color: c.textSecondary, marginTop: 2 }]}>
                  {[plan.form || t('formNotSet'), plan.strength].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' }}>
              <Badge label={t(statusLabelKey(plan.request.status))} tone={statusTone(plan.request.status)} />
              <Badge label={t(cadenceLabelKey(plan.cadence))} tone="accent" />
            </View>

            <View style={{ gap: spacing(1.5), paddingTop: spacing(1) }}>
              <Text style={[typography.caption, { color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                {t('medicationTimes')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' }}>
                {plan.times.map((time) => (
                  <View
                    key={time}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: spacing(3),
                      paddingVertical: spacing(1.5),
                      borderRadius: radius.full,
                      backgroundColor: c.surfaceRaised,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: c.separator,
                    }}
                  >
                    <Ionicons name="time-outline" size={14} color={c.accent} />
                    <Text style={[typography.headline, { color: c.textPrimary, fontSize: 13 }]}>{time}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Button
              kind="primary"
              label={t('editMedicationPlanCta')}
              onPress={() => router.push(`/medications/${plan.request.id}/edit`)}
            />
          </View>
        </Card>

        {/* Visual Supply & Refill Meter */}
        <View>
          <SectionHeader title={t('medicationSupplySectionTitle')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text
                    style={[
                      typography.metricSm,
                      {
                        color:
                          typeof supplyCount === 'number' && supplyCount <= 0
                            ? c.destructive
                            : typeof supplyCount === 'number' && supplyCount <= 7
                              ? c.warning
                              : c.textPrimary,
                        fontVariant: ['tabular-nums'],
                      },
                    ]}
                  >
                    {typeof supplyCount === 'number' ? supplyCount.toString() : '—'}
                  </Text>
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>
                    {t('supplyRemaining').replace('{count}', (supplyCount ?? 0).toString())}
                  </Text>
                </View>

                {typeof daysUntilRefill === 'number' ? (
                  <Badge
                    label={`${daysUntilRefill.toString()} ${t('supplyDaysUntilRefill').toLowerCase()}`}
                    tone={daysUntilRefill <= 7 ? 'warning' : 'neutral'}
                  />
                ) : null}
              </View>

              {typeof supplyCount === 'number' ? (
                <View style={{ gap: spacing(1.5) }}>
                  <AnimatedProgressBar
                    progress={Math.min(1, Math.max(0, supplyCount / 30))}
                    color={supplyCount <= 0 ? c.destructive : supplyCount <= 7 ? c.warning : c.accent}
                    height={8}
                  />
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.caption, { color: c.textSecondary }]}>
                  {t('supplyLastRefilled')}:{' '}
                  {lastRefilledAt
                    ? formatDateTime(new Date(lastRefilledAt), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </Text>
              </View>

              <Button
                kind="secondary"
                label={quickRefilling ? t('quickRefillAdding') : t('quickRefillAction')}
                onPress={() => void handleQuickRefill(30)}
                disabled={quickRefilling}
              />
            </View>
          </Card>
        </View>

        {/* Actions Section */}
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

        {/* Dose History Logs with Status Icons */}
        <View>
          <SectionHeader title={t('recentDoseLogsTitle')} />
          {relatedEvents.length === 0 ? (
            <EmptyState title={t('noDoseLogsYetTitle')} description={t('noDoseLogsYetHint')} />
          ) : (
            <ListGroup>
              {relatedEvents.map((event, index) => {
                const scheduledAt = event.extension?.find((entry) => entry.url === TAKT_EXT.scheduledTime)?.valueDateTime;
                const effectiveAt = event.effectiveDateTime;

                const isTaken = event.status === 'completed';
                const isSkipped = event.statusReason?.[0]?.coding?.[0]?.code === 'patient-refusal';
                const actionLabel = isTaken ? t('statusTaken') : isSkipped ? t('statusSkipped') : t('statusMissed');
                const iconName = isTaken ? 'checkmark' : isSkipped ? 'pause' : 'alert';
                const iconColor = isTaken ? c.success : isSkipped ? c.warning : c.destructive;
                const iconBg = isTaken ? `${c.success}1A` : isSkipped ? `${c.warning}1A` : `${c.destructive}1A`;

                const timestamp = scheduledAt ?? effectiveAt;
                const subtitle = timestamp
                  ? `${actionLabel} · ${formatDateTime(new Date(timestamp))}`
                  : actionLabel;

                return (
                  <ListRow
                    key={event.id}
                    isFirst={index === 0}
                    title={plan.label}
                    subtitle={subtitle}
                    leading={
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.md,
                          backgroundColor: iconBg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name={iconName} size={16} color={iconColor} />
                      </View>
                    }
                  />
                );
              })}
            </ListGroup>
          )}
        </View>
      </Stack>
    </PageShell>
  );
}
