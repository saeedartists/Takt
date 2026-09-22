import { Ionicons } from '@expo/vector-icons';
import { Stack as RouterStack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import {
  AnimatedPressable,
  AnimatedProgressBar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
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
import {
  MedicationActionSheet,
  duplicateParams,
  pausedUntil,
  usePlanStatusUpdate,
  type SheetStep,
} from '@/components/takt/medication-action-sheet';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { TAKT_EXT } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { formatDayLabel } from '@/lib/takt/medication-form';
import { LOW_SUPPLY_THRESHOLD, getSupplySnapshot, type SupplySnapshot } from '@/lib/takt/supply-tracker';
import { isoDateKey } from '@/lib/takt/time';
import type { MedicationAdministrationResource, MedicationPlan } from '@/lib/takt/types';

type IconName = ComponentProps<typeof Ionicons>['name'];

const expand = LinearTransition.springify()
  .damping(motion.spring.gentle.damping)
  .stiffness(motion.spring.gentle.stiffness);

const statusTone = (status: string): 'success' | 'warning' | 'destructive' =>
  status === 'on-hold' ? 'warning' : status === 'stopped' ? 'destructive' : 'success';

const statusLabelKey = (status: string): 'statusActive' | 'statusPaused' | 'statusArchived' =>
  status === 'on-hold' ? 'statusPaused' : status === 'stopped' ? 'statusArchived' : 'statusActive';

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
  const { enter } = useMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const statusUpdate = usePlanStatusUpdate(patientRef);

  const plan = useMemo(() => plans.plans.find((entry) => entry.request.id === id), [id, plans.plans]);

  const [statusError, setStatusError] = useState<string | null>(null);
  /** undefined while loading, null when no count was ever set. */
  const [supply, setSupply] = useState<SupplySnapshot | null | undefined>(undefined);
  const [sheet, setSheet] = useState<SheetStep | null>(null);

  const reloadSupply = useCallback(async () => {
    const medicationId = plan?.medication?.id;
    setSupply(medicationId ? await getSupplySnapshot(medicationId) : null);
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

  /** Resume and Restore are one tap; Pause and Archive go through the sheet because they ask a question. */
  const setActive = async (target: MedicationPlan) => {
    setStatusError(null);
    try {
      await statusUpdate.update(target, 'active');
    } catch {
      setStatusError(t('medicationStatusActionError'));
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
  const until = pausedUntil(plan);
  const cadenceText =
    plan.cadence === 'daily'
      ? t('cadenceDaily')
      : plan.cadence === 'weekdays'
        ? t('cadenceWeekdays')
        : plan.dayOfWeek.map((day) => formatDayLabel(day, t)).join(', ');
  const supplyTone =
    supply && supply.count <= 0 ? 'destructive' : supply && supply.count <= LOW_SUPPLY_THRESHOLD ? 'warning' : 'neutral';
  const supplyColor = supplyTone === 'destructive' ? c.destructive : supplyTone === 'warning' ? c.warning : c.accent;

  return (
    <PageShell>
      <RouterStack.Screen options={{ title }} />

      <Stack>
        {/* Hero: what it is */}
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
                <Badge
                  label={
                    until
                      ? t('pausedUntil').replace('{date}', formatDate(until, { day: 'numeric', month: 'short' }))
                      : t(statusLabelKey(status))
                  }
                  tone={statusTone(status)}
                />
              </View>

              <Button
                kind="secondary"
                label={t('editMedicationPlanCta')}
                icon={<Ionicons name="create-outline" size={18} color={c.textPrimary} />}
                onPress={() => router.push(`/medications/${plan.request.id}/edit`)}
              />
            </View>
          </Card>
        </Animated.View>

        {/* Schedule: when, and whether it is running */}
        <Animated.View entering={enter(1)} layout={expand}>
          <SectionHeader title={t('medicationScheduleSectionTitle')} />
          <Card>
            <View style={styles.cardBody}>
              <View style={{ gap: spacing(1) }}>
                <Text style={[typography.overline, { color: c.textSecondary }]}>{t('medicationCadence')}</Text>
                <Text style={[typography.body, { color: c.textPrimary }]}>{cadenceText}</Text>
              </View>
              <View style={{ gap: spacing(1.5) }}>
                <Text style={[typography.overline, { color: c.textSecondary }]}>{t('medicationTimes')}</Text>
                <View style={styles.wrapRow}>
                  {plan.times.map((time) => (
                    <View key={time} style={[styles.timeChip, { backgroundColor: c.surfaceRaised, borderColor: c.separator }]}>
                      <Ionicons name="time-outline" size={14} color={c.accent} />
                      <Text style={[typography.subhead, { color: c.textPrimary, fontWeight: '600', fontVariant: ['tabular-nums'] }]}>
                        {time}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {status === 'active' ? (
                <Button
                  kind="secondary"
                  label={t('pauseCta')}
                  accessibilityLabel={t('pauseMedicationCta')}
                  icon={<Ionicons name="pause-circle-outline" size={18} color={c.textPrimary} />}
                  onPress={() => setSheet('pause')}
                  disabled={statusUpdate.isPending}
                />
              ) : null}
              {status === 'on-hold' ? (
                <Button
                  label={t('resumeCta')}
                  accessibilityLabel={t('resumeMedicationCta')}
                  icon={<Ionicons name="play-circle-outline" size={18} color={c.surface} />}
                  onPress={() => void setActive(plan)}
                  loading={statusUpdate.isPending}
                />
              ) : null}
              {status === 'stopped' ? (
                <Button
                  label={t('restoreCta')}
                  icon={<Ionicons name="refresh-circle-outline" size={18} color={c.surface} />}
                  onPress={() => void setActive(plan)}
                  loading={statusUpdate.isPending}
                />
              ) : null}
              {statusError ? (
                <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>
                  {statusError}
                </Text>
              ) : null}
            </View>
          </Card>
        </Animated.View>

        {/* Supply: how much is left, and the refill */}
        <Animated.View entering={enter(2)} layout={expand}>
          <SectionHeader title={t('medicationSupplySectionTitle')} />
          <Card>
            <View style={styles.cardBody}>
              {supply ? (
                <>
                  <View style={styles.spaceBetween}>
                    <View>
                      <Text style={[typography.metricSm, { color: supplyTone === 'neutral' ? c.textPrimary : supplyColor, fontVariant: ['tabular-nums'] }]}>
                        {supply.count}
                      </Text>
                      <Text style={[typography.footnote, { color: c.textSecondary }]}>
                        {t('supplyRemaining').replace('{count}', String(supply.count))}
                      </Text>
                    </View>
                    <Badge label={t('supplyDaysLeft').replace('{days}', String(supply.daysUntilRefill))} tone={supplyTone} />
                  </View>
                  <AnimatedProgressBar progress={Math.min(1, supply.count / supply.capacity)} color={supplyColor} height={8} />
                  <Text style={[typography.caption, { color: c.textSecondary }]}>
                    {t('supplyLastRefilled')}:{' '}
                    {supply.lastRefilledAt
                      ? formatDate(new Date(supply.lastRefilledAt), { year: 'numeric', month: 'short', day: 'numeric' })
                      : '—'}
                  </Text>
                </>
              ) : (
                <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('medicationSupplyOptional')}</Text>
              )}
              {status !== 'stopped' ? (
                <Button
                  kind="secondary"
                  label={supply ? t('refillCta') : t('supplySet')}
                  accessibilityLabel={t('logRefillCta')}
                  icon={<Ionicons name="add-circle-outline" size={18} color={c.textPrimary} />}
                  onPress={() => setSheet('refill')}
                />
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

        {/* Footer: rarely used, destructive last */}
        <Animated.View entering={enter(4)} layout={expand}>
          <ListGroup>
            <ListRow
              isFirst
              title={t('duplicateCta')}
              subtitle={t('duplicateMedicationCta')}
              leading={<Ionicons name="copy-outline" size={20} color={c.textSecondary} />}
              onPress={() => router.push({ pathname: '/medications/new', params: duplicateParams(plan) } as never)}
            />
            {status !== 'stopped' ? (
              <AnimatedPressable
                onPress={() => setSheet('archive')}
                accessibilityRole="button"
                accessibilityLabel={t('archiveMedicationCta')}
                style={[styles.destructiveRow, { borderTopColor: c.separator }]}
              >
                <Ionicons name="archive-outline" size={20} color={c.destructive} />
                <Text style={[typography.body, { color: c.destructive, flex: 1 }]}>{t('archiveCta')}</Text>
              </AnimatedPressable>
            ) : null}
          </ListGroup>
        </Animated.View>
      </Stack>

      <MedicationActionSheet
        plan={sheet ? plan : null}
        patientRef={patientRef}
        initialStep={sheet ?? 'root'}
        onClose={() => setSheet(null)}
        onChanged={() => void reloadSupply()}
      />
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
  dot: { width: 10, height: 10, borderRadius: radius.full },
  destructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    minHeight: 52,
    paddingHorizontal: spacing(4),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
