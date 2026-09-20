import { Ionicons } from '@expo/vector-icons';
import { Stack as RouterStack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import {
  AnimatedProgressBar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListGroup,
  ListRow,
  PageShell,
  SectionHeader,
  SkeletonCard,
  SkeletonRow,
  Stack,
  motion,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Chip } from '@/components/takt/medication-form';
import { TimeField } from '@/components/takt/time-field';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useUpdateMedicationPlan } from '@/lib/hooks/use-takt-mutations';
import { TAKT_EXT } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { normalizeDateInput, parseSupply } from '@/lib/takt/medication-form';
import {
  getDaysUntilRefill,
  getLastRefilledAt,
  getSupplyCount,
  setSupplyCount,
} from '@/lib/takt/supply-tracker';
import { isoDateKey } from '@/lib/takt/time';
import type { MedicationAdministrationResource } from '@/lib/takt/types';

type IconName = ComponentProps<typeof Ionicons>['name'];
type PlanStatus = 'active' | 'on-hold' | 'stopped';

const REFILL_PRESETS = [28, 30, 60, 90];
const LOW_SUPPLY = 7;

const expand = LinearTransition.springify()
  .damping(motion.spring.gentle.damping)
  .stiffness(motion.spring.gentle.stiffness);

const statusTone = (status: string): 'success' | 'warning' | 'destructive' =>
  status === 'on-hold' ? 'warning' : status === 'stopped' ? 'destructive' : 'success';

const statusLabelKey = (status: string): 'statusActive' | 'statusPaused' | 'statusArchived' =>
  status === 'on-hold' ? 'statusPaused' : status === 'stopped' ? 'statusArchived' : 'statusActive';

const cadenceLabelKey = (
  cadence: 'daily' | 'weekdays' | 'custom',
): 'cadenceDaily' | 'cadenceWeekdays' | 'cadenceSpecificDays' =>
  cadence === 'weekdays' ? 'cadenceWeekdays' : cadence === 'custom' ? 'cadenceSpecificDays' : 'cadenceDaily';

const formIcon = (form: string): IconName => {
  const key = form.toLowerCase();
  if (key.includes('capsule')) return 'medkit';
  if (key.includes('drop')) return 'water';
  if (key.includes('inhal')) return 'cloud-outline';
  if (key.includes('syrup')) return 'flask';
  return 'medical';
};

const eventTimestamp = (event: MedicationAdministrationResource): string | undefined =>
  event.extension?.find((entry) => entry.url === TAKT_EXT.scheduledTime)?.valueDateTime ?? event.effectiveDateTime;

const eventState = (event: MedicationAdministrationResource): 'taken' | 'skipped' | 'missed' => {
  if (event.status === 'completed') return 'taken';
  return event.statusReason?.[0]?.coding?.[0]?.code === 'patient-refusal' ? 'skipped' : 'missed';
};

export default function MedicationDetailsScreen() {
  const { c } = useTokens();
  const { t, formatDate, formatTime } = useLocale();
  const { enter, duration } = useMotion();
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
  const [panel, setPanel] = useState<'refill' | 'archive' | 'pause' | null>(null);
  /** YYYY-MM-DD; the pause ends at the end of that local day. */
  const [pauseUntil, setPauseUntil] = useState('');
  const [pendingAction, setPendingAction] = useState<'pause' | 'resume' | 'archive' | null>(null);
  const [refillInput, setRefillInput] = useState('30');
  const [refilling, setRefilling] = useState(false);

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

  // Recent logs, newest first, grouped by calendar day.
  const dayGroups = useMemo(() => {
    if (!plan) return [];
    const related = (events.data?.entry ?? [])
      .map((entry) => entry.resource)
      .filter((entry) => entry.request?.reference === `MedicationRequest/${plan.request.id}`)
      .map((event) => ({ event, at: new Date(eventTimestamp(event) ?? 0) }))
      .filter(({ at }) => !Number.isNaN(at.getTime()))
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 8);

    const groups = new Map<string, { date: Date; items: typeof related }>();
    for (const item of related) {
      const key = isoDateKey(item.at);
      const group = groups.get(key) ?? { date: item.at, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
    return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
  }, [events.data?.entry, plan]);

  /** A pause ends at the end of the chosen local day. */
  const endOfDayIso = (date: string): string | null => {
    if (!normalizeDateInput(date)) return null;
    const end = new Date(`${date}T00:00:00`);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  };
  const pauseUntilIso = endOfDayIso(pauseUntil);

  const updateStatus = async (
    nextStatus: PlanStatus,
    action: 'pause' | 'resume' | 'archive',
    pauseEnd?: string,
  ) => {
    if (!plan || !patientRef || !plan.medication) return;
    setStatusError(null);
    setPendingAction(action);
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
        pauseUntil: pauseEnd,
        request: plan.request,
        medication: plan.medication,
      });
      setPanel(null);
    } catch {
      setStatusError(t('medicationStatusActionError'));
    } finally {
      setPendingAction(null);
    }
  };

  const refillAmount = parseSupply(refillInput);
  const logRefill = async () => {
    const medicationId = plan?.medication?.id;
    if (!medicationId || !refillAmount) return;
    setRefilling(true);
    try {
      await setSupplyCount(medicationId, (supplyCount ?? 0) + refillAmount);
      await reloadSupply();
      setPanel(null);
    } finally {
      setRefilling(false);
    }
  };

  const title = plan?.label ?? t('medicationDetailsRouteTitle');

  if (patient.isLoading || plans.isLoading || events.isLoading) {
    return (
      <PageShell>
        <RouterStack.Screen options={{ title }} />
        <Stack>
          <SkeletonCard rows={2} />
          <SkeletonCard rows={1} />
          <ListGroup>
            <SkeletonRow isFirst />
            <SkeletonRow />
            <SkeletonRow />
          </ListGroup>
        </Stack>
      </PageShell>
    );
  }

  if (patient.error || plans.error || events.error) {
    return (
      <PageShell>
        <RouterStack.Screen options={{ title }} />
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
        <RouterStack.Screen options={{ title }} />
        <EmptyState title={t('medicationNotFound')} description={t('medicationNotFoundHint')} />
      </PageShell>
    );
  }

  const status = plan.request.status;
  const busy = updatePlan.isPending || refilling;
  const supplyColor =
    typeof supplyCount !== 'number' ? c.textPrimary : supplyCount <= 0 ? c.destructive : supplyCount <= LOW_SUPPLY ? c.warning : c.textPrimary;
  const barColor =
    typeof supplyCount === 'number' && supplyCount <= 0 ? c.destructive : typeof supplyCount === 'number' && supplyCount <= LOW_SUPPLY ? c.warning : c.accent;

  return (
    <PageShell>
      <RouterStack.Screen options={{ title }} />

      <Stack>
        {/* Hero */}
        <Animated.View entering={enter(0)} layout={expand}>
          <Card>
            <View style={styles.cardBody}>
              <View style={styles.heroRow}>
                <View style={[styles.heroIcon, { backgroundColor: `${c.accent}1A`, borderColor: `${c.accent}33` }]}>
                  <Ionicons name={formIcon(plan.form)} size={26} color={c.accent} />
                </View>
                <View style={styles.grow}>
                  <Text style={[typography.title2, { color: c.textPrimary }]} numberOfLines={2}>
                    {plan.label}
                  </Text>
                  <Text style={[typography.subhead, { color: c.textSecondary, marginTop: 2 }]}>
                    {[plan.form || t('formNotSet'), plan.strength].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>

              <View style={styles.wrapRow}>
                <Badge label={t(statusLabelKey(status))} tone={statusTone(status)} />
                <Badge label={t(cadenceLabelKey(plan.cadence))} tone="accent" />
              </View>

              <View style={{ gap: spacing(1.5) }}>
                <Text style={[typography.overline, { color: c.textSecondary }]}>{t('medicationTimes')}</Text>
                <View style={styles.wrapRow}>
                  {plan.times.map((time) => (
                    <View
                      key={time}
                      style={[styles.timeChip, { backgroundColor: c.surfaceRaised, borderColor: c.separator }]}
                    >
                      <Ionicons name="time-outline" size={14} color={c.accent} />
                      <Text style={[typography.subhead, { color: c.textPrimary, fontWeight: '600', fontVariant: ['tabular-nums'] }]}>
                        {time}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <Button
                kind="primary"
                label={t('editMedicationPlanCta')}
                icon={<Ionicons name="create-outline" size={18} color={c.surface} />}
                onPress={() => router.push(`/medications/${plan.request.id}/edit`)}
              />
            </View>
          </Card>
        </Animated.View>

        {/* Supply */}
        <Animated.View entering={enter(1)} layout={expand}>
          <SectionHeader title={t('medicationSupplySectionTitle')} />
          <Card>
            <View style={styles.cardBody}>
              <View style={styles.spaceBetween}>
                <View>
                  <Text style={[typography.metricSm, { color: supplyColor, fontVariant: ['tabular-nums'] }]}>
                    {typeof supplyCount === 'number' ? supplyCount.toString() : '—'}
                  </Text>
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>
                    {t('supplyRemaining').replace('{count}', (supplyCount ?? 0).toString())}
                  </Text>
                </View>
                {typeof daysUntilRefill === 'number' ? (
                  <Badge
                    label={`${daysUntilRefill} ${t('supplyDaysUntilRefill').toLowerCase()}`}
                    tone={daysUntilRefill <= 0 ? 'destructive' : daysUntilRefill <= LOW_SUPPLY ? 'warning' : 'neutral'}
                  />
                ) : null}
              </View>

              {typeof supplyCount === 'number' ? (
                <AnimatedProgressBar progress={Math.min(1, Math.max(0, supplyCount / 30))} color={barColor} height={8} />
              ) : null}

              <Text style={[typography.caption, { color: c.textSecondary }]}>
                {t('supplyLastRefilled')}:{' '}
                {lastRefilledAt
                  ? formatDate(new Date(lastRefilledAt), { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—'}
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={enter(2)} layout={expand}>
          <SectionHeader title={t('medicationFlowActionsTitle')} />
          <Card>
            <View style={styles.cardBody}>
              <View style={styles.grid}>
                {status === 'active' ? (
                  <View style={styles.gridItem}>
                    <Button
                      size="sm"
                      kind="secondary"
                      label={t('pauseCta')}
                      accessibilityLabel={t('pauseMedicationCta')}
                      icon={<Ionicons name="pause-circle-outline" size={18} color={c.textPrimary} />}
                      onPress={() => setPanel((prev) => (prev === 'pause' ? null : 'pause'))}
                      loading={pendingAction === 'pause'}
                      disabled={busy}
                    />
                  </View>
                ) : null}
                {status === 'on-hold' ? (
                  <View style={styles.gridItem}>
                    <Button
                      size="sm"
                      kind="secondary"
                      label={t('resumeCta')}
                      accessibilityLabel={t('resumeMedicationCta')}
                      icon={<Ionicons name="play-circle-outline" size={18} color={c.textPrimary} />}
                      onPress={() => void updateStatus('active', 'resume')}
                      loading={pendingAction === 'resume'}
                      disabled={busy}
                    />
                  </View>
                ) : null}
                <View style={styles.gridItem}>
                  <Button
                    size="sm"
                    kind="secondary"
                    label={t('refillCta')}
                    accessibilityLabel={t('logRefillCta')}
                    icon={<Ionicons name="add-circle-outline" size={18} color={c.textPrimary} />}
                    onPress={() => setPanel((prev) => (prev === 'refill' ? null : 'refill'))}
                    disabled={busy}
                  />
                </View>
                <View style={styles.gridItem}>
                  <Button
                    size="sm"
                    kind="secondary"
                    label={t('timelineCta')}
                    accessibilityLabel={t('openTodayTimelineCta')}
                    icon={<Ionicons name="calendar-outline" size={18} color={c.textPrimary} />}
                    onPress={() => router.push('/(tabs)/today')}
                  />
                </View>
                <View style={styles.gridItem}>
                  <Button
                    size="sm"
                    kind="secondary"
                    label={t('duplicateCta')}
                    accessibilityLabel={t('duplicateMedicationCta')}
                    icon={<Ionicons name="copy-outline" size={18} color={c.textPrimary} />}
                    onPress={() =>
                      router.push({
                        pathname: '/medications/new',
                        params: {
                          name: plan.label,
                          form: plan.form,
                          strength: plan.strength,
                          times: plan.times.join(','),
                          cadence: plan.cadence,
                          days: plan.dayOfWeek.join(','),
                        },
                      } as never)
                    }
                  />
                </View>
                {status !== 'stopped' ? (
                  <View style={styles.gridItem}>
                    <Button
                      size="sm"
                      kind="destructive"
                      label={t('archiveCta')}
                      accessibilityLabel={t('archiveMedicationCta')}
                      icon={<Ionicons name="archive-outline" size={18} color={c.destructive} />}
                      onPress={() => setPanel((prev) => (prev === 'archive' ? null : 'archive'))}
                      disabled={busy}
                    />
                  </View>
                ) : null}
              </View>

              {panel === 'refill' ? (
                <Animated.View
                  entering={FadeIn.duration(duration.fast)}
                  exiting={FadeOut.duration(duration.fast)}
                  style={{ gap: spacing(3) }}
                >
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('refillAmountLabel')}</Text>
                  <View style={styles.wrapRow}>
                    {REFILL_PRESETS.map((amount) => (
                      <Chip
                        key={amount}
                        label={`+${amount}`}
                        selected={refillInput === amount.toString()}
                        onPress={() => setRefillInput(amount.toString())}
                      />
                    ))}
                    <View style={styles.customInput}>
                      <Input
                        value={REFILL_PRESETS.some((amount) => amount.toString() === refillInput) ? '' : refillInput}
                        onChangeText={(next) => setRefillInput(next.replace(/[^\d]/g, ''))}
                        keyboardType="number-pad"
                        inputMode="numeric"
                        placeholder={t('refillCustomPlaceholder')}
                        accessibilityLabel={t('refillCustomPlaceholder')}
                        style={styles.customInputField}
                      />
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <View style={styles.grow}>
                      <Button size="sm" kind="secondary" label={t('cancel')} onPress={() => setPanel(null)} disabled={refilling} />
                    </View>
                    <View style={styles.grow}>
                      <Button
                        size="sm"
                        label={refillAmount ? `${t('logRefillCta')} (+${refillAmount})` : t('logRefillCta')}
                        onPress={() => void logRefill()}
                        loading={refilling}
                        disabled={!refillAmount}
                        haptic="success"
                      />
                    </View>
                  </View>
                </Animated.View>
              ) : null}

              {panel === 'pause' ? (
                <Animated.View
                  entering={FadeIn.duration(duration.fast)}
                  exiting={FadeOut.duration(duration.fast)}
                  style={{ gap: spacing(3) }}
                >
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('pauseUntilHint')}</Text>
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('pauseUntilLabel')}</Text>
                  <TimeField
                    mode="date"
                    value={pauseUntil}
                    onChange={setPauseUntil}
                    accessibilityLabel={t('pauseUntilLabel')}
                  />
                  <View style={styles.actionRow}>
                    <View style={styles.grow}>
                      <Button
                        size="sm"
                        kind="secondary"
                        label={t('pauseNowCta')}
                        onPress={() => void updateStatus('on-hold', 'pause')}
                        loading={pendingAction === 'pause' && !pauseUntilIso}
                        disabled={busy}
                      />
                    </View>
                    <View style={styles.grow}>
                      <Button
                        size="sm"
                        label={t('pauseUntilCta')}
                        onPress={() => {
                          if (pauseUntilIso) void updateStatus('on-hold', 'pause', pauseUntilIso);
                        }}
                        loading={pendingAction === 'pause' && Boolean(pauseUntilIso)}
                        disabled={busy || !pauseUntilIso}
                      />
                    </View>
                  </View>
                </Animated.View>
              ) : null}

              <ConfirmSheet
                open={panel === 'archive'}
                title={t('archiveConfirmTitle')}
                body={t('archiveConfirmBody')}
                confirmLabel={t('archiveCta')}
                cancelLabel={t('cancel')}
                onConfirm={() => void updateStatus('stopped', 'archive')}
                onCancel={() => setPanel(null)}
                loading={pendingAction === 'archive'}
              />

              {statusError ? (
                <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>
                  {statusError}
                </Text>
              ) : null}
            </View>
          </Card>
        </Animated.View>

        {/* Recent dose logs */}
        <Animated.View entering={enter(3)} layout={expand}>
          <SectionHeader title={t('recentDoseLogsTitle')} />
          {dayGroups.length === 0 ? (
            <EmptyState title={t('noDoseLogsYetTitle')} description={t('noDoseLogsYetHint')} />
          ) : (
            <View style={{ gap: spacing(3) }}>
              {dayGroups.map((group) => (
                <View key={group.key} style={{ gap: spacing(1.5) }}>
                  <Text style={[typography.overline, { color: c.textSecondary, paddingHorizontal: spacing(1) }]}>
                    {formatDate(group.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                  <ListGroup>
                    {group.items.map(({ event, at }, index) => {
                      const state = eventState(event);
                      const dotColor = state === 'taken' ? c.success : state === 'skipped' ? c.warning : c.destructive;
                      const label = state === 'taken' ? t('statusTaken') : state === 'skipped' ? t('statusSkipped') : t('statusMissed');
                      return (
                        <ListRow
                          key={event.id}
                          isFirst={index === 0}
                          title={label}
                          value={formatTime(at)}
                          leading={<View style={[styles.dot, { backgroundColor: dotColor }]} />}
                        />
                      );
                    })}
                  </ListGroup>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  cardBody: { padding: spacing(4), gap: spacing(3.5) },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1, minWidth: 0 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing(2) },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
  actionRow: { flexDirection: 'row', gap: spacing(2) },
  customInput: { width: 104 },
  customInputField: { minHeight: 40, paddingVertical: 0 },
  dot: { width: 10, height: 10, borderRadius: radius.full },
});
