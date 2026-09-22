import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedPressable,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListGroup,
  ListRow,
  PageHeader,
  PageShell,
  SectionHeader,
  SkeletonRow,
  Stack,
  radius,
  spacing,
  useMotion,
  useTokens,
} from '@/components/ui';
import { MedicationActionSheet, pausedUntil, type SheetStep } from '@/components/takt/medication-action-sheet';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';
import { formatDayLabel } from '@/lib/takt/medication-form';
import { LOW_SUPPLY_THRESHOLD, getSupplySnapshot, type SupplySnapshot } from '@/lib/takt/supply-tracker';
import type { MedicationPlan } from '@/lib/takt/types';

/** Most people have three to five medications; a search box only earns its place beyond that. */
const SEARCH_FROM = 6;
const CLEAR_HIT = 44;

type SupplyMap = Record<string, SupplySnapshot | null>;

const getFormIconName = (form?: string): keyof typeof Ionicons.glyphMap => {
  const normalized = (form ?? '').toLowerCase();
  if (normalized.includes('capsul') || normalized.includes('kapsel')) return 'bandage-outline';
  if (normalized.includes('drop') || normalized.includes('tropf')) return 'water-outline';
  if (normalized.includes('inhal')) return 'fitness-outline';
  if (normalized.includes('inject') || normalized.includes('injekt')) return 'color-filter-outline';
  return 'medkit';
};

export default function MedicationsScreen() {
  const { c } = useTokens();
  const { t, formatDate } = useLocale();
  const { enter } = useMotion();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);

  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [supplyByMedication, setSupplyByMedication] = useState<SupplyMap>({});
  const [sheet, setSheet] = useState<{ plan: MedicationPlan; step: SheetStep } | null>(null);

  const isLoading = patient.isLoading || plans.isLoading;
  // Stagger rows once, on the first render that has data; later changes only re-layout.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (!isLoading) firstLoad.current = false;
  }, [isLoading]);

  const refreshSupply = useCallback(async () => {
    const next: SupplyMap = {};
    for (const plan of plans.plans) {
      const medicationId = plan.medication?.id;
      if (!medicationId) continue;
      next[medicationId] = await getSupplySnapshot(medicationId);
    }
    setSupplyByMedication(next);
  }, [plans.plans]);

  useFocusEffect(
    useCallback(() => {
      void refreshSupply();
    }, [refreshSupply]),
  );

  const filteredPlans = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return plans.plans;
    return plans.plans.filter((plan) =>
      `${plan.label} ${plan.form ?? ''} ${plan.strength ?? ''}`.toLowerCase().includes(search),
    );
  }, [plans.plans, searchTerm]);

  const activePlans = filteredPlans.filter((plan) => plan.request.status === 'active');
  const pausedPlans = filteredPlans.filter((plan) => plan.request.status === 'on-hold');
  const archivedPlans = filteredPlans.filter((plan) => plan.request.status === 'stopped');

  const cadenceText = (plan: MedicationPlan): string => {
    if (plan.cadence === 'daily') return t('cadenceDaily');
    if (plan.cadence === 'weekdays') return t('cadenceWeekdays');
    return plan.dayOfWeek.map((day) => formatDayLabel(day, t)).join(', ');
  };

  const statusTint = (plan: MedicationPlan): string =>
    plan.request.status === 'active' ? c.accent : plan.request.status === 'on-hold' ? c.warning : c.textTertiary;

  // Third line, by priority: pause end, then the supply state, or the way to set one.
  const rowMeta = (plan: MedicationPlan) => {
    if (plan.request.status === 'on-hold') {
      const until = pausedUntil(plan);
      return until
        ? t('pausedUntil').replace('{date}', formatDate(until, { day: 'numeric', month: 'short' }))
        : t('statusPaused');
    }
    if (plan.request.status === 'stopped') return undefined;

    const medicationId = plan.medication?.id;
    const supply = medicationId ? supplyByMedication[medicationId] : undefined;
    if (supply === undefined) return undefined;
    if (supply === null) return t('supplySet');
    if (supply.count <= 0) return <Badge label={t('supplyRefillNeeded')} tone="destructive" />;
    if (supply.count <= LOW_SUPPLY_THRESHOLD) {
      return (
        <Badge
          label={`${t('supplyLow')} · ${t('supplyLeft').replace('{count}', String(supply.count))}`}
          tone="warning"
        />
      );
    }
    return t('supplyLeftDays')
      .replace('{count}', String(supply.count))
      .replace('{days}', String(supply.daysUntilRefill));
  };

  const renderList = (rows: MedicationPlan[], offset: number) => (
    <ListGroup>
      {rows.map((plan, index) => {
        const tint = statusTint(plan);
        return (
          <Animated.View
            key={plan.request.id}
            entering={firstLoad.current ? enter(offset + index) : undefined}
            layout={LinearTransition}
          >
            <ListRow
              isFirst={index === 0}
              title={plan.label}
              subtitle={[cadenceText(plan), plan.times.join(', '), plan.strength || plan.form || t('formNotSet')].join(' · ')}
              meta={rowMeta(plan)}
              leading={
                <View style={[styles.formIcon, { backgroundColor: `${tint}1A` }]}>
                  <Ionicons name={getFormIconName(plan.form)} size={16} color={tint} />
                </View>
              }
              action={
                <AnimatedPressable
                  onPress={() => setSheet({ plan, step: 'root' })}
                  accessibilityRole="button"
                  accessibilityLabel={t('moreActionsFor').replace('{name}', plan.label)}
                  hitSlop={4}
                  style={[styles.more, { backgroundColor: c.surfaceRaised }]}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={c.textPrimary} />
                </AnimatedPressable>
              }
              onPress={() => router.push({ pathname: '/medications/[id]', params: { id: plan.request.id } })}
            />
          </Animated.View>
        );
      })}
    </ListGroup>
  );

  return (
    <PageShell>
      <PageHeader
        title={t('medications')}
        action={
          <Button
            size="sm"
            label={t('addCta')}
            icon={<Ionicons name="add" size={16} color={c.surface} />}
            accessibilityLabel={t('addMedication')}
            onPress={() => router.push('/medications/new')}
          />
        }
      />

      <Stack>
        {plans.plans.length >= SEARCH_FROM ? (
          <View>
            <Input
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder={t('medsSearchPlaceholder')}
              returnKeyType="search"
              accessibilityLabel={t('medsSearchPlaceholder')}
              style={{ paddingRight: CLEAR_HIT }}
            />
            {searchTerm ? (
              <AnimatedPressable
                onPress={() => setSearchTerm('')}
                accessibilityRole="button"
                accessibilityLabel={t('medsSearchClear')}
                style={styles.clear}
              >
                <Ionicons name="close-circle" size={18} color={c.textTertiary} />
              </AnimatedPressable>
            ) : null}
          </View>
        ) : null}

        <View>
          {isLoading ? (
            <Card>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonRow key={i} isFirst={i === 0} />
              ))}
            </Card>
          ) : patient.error || plans.error ? (
            <ErrorState
              description={t('loadMedicationsError')}
              onRetry={() => {
                void patient.refetch();
                void plans.requestsQuery.refetch();
                void plans.medicationsQuery.refetch();
                void refreshSupply();
              }}
            />
          ) : plans.plans.length === 0 ? (
            <EmptyState
              title={t('noMedsYet')}
              description={t('addMedicationCadenceHint')}
              action={<Button label={t('addMedication')} onPress={() => router.push('/medications/new')} />}
            />
          ) : filteredPlans.length === 0 ? (
            <EmptyState title={t('noMedsMatchFilter')} description={t('addMedicationCadenceHint')} />
          ) : (
            <Stack>
              {activePlans.length > 0 ? (
                <View>
                  <SectionHeader title={t('statusActive')} />
                  {renderList(activePlans, 0)}
                </View>
              ) : null}

              {pausedPlans.length > 0 ? (
                <View>
                  <SectionHeader title={t('statusPaused')} />
                  {renderList(pausedPlans, activePlans.length)}
                </View>
              ) : null}

              {archivedPlans.length > 0 ? (
                <Animated.View layout={LinearTransition} style={{ gap: spacing(3) }}>
                  <Button
                    kind="secondary"
                    label={t('archivedMedicationsCount').replace('{count}', String(archivedPlans.length))}
                    icon={<Ionicons name={showArchived ? 'chevron-up' : 'chevron-down'} size={16} color={c.textPrimary} />}
                    onPress={() => setShowArchived((open) => !open)}
                  />
                  {showArchived ? renderList(archivedPlans, activePlans.length + pausedPlans.length) : null}
                </Animated.View>
              ) : null}
            </Stack>
          )}
        </View>
      </Stack>

      <MedicationActionSheet
        plan={sheet?.plan ?? null}
        patientRef={patientRef}
        initialStep={sheet?.step ?? 'root'}
        onClose={() => setSheet(null)}
        onChanged={() => void refreshSupply()}
      />
    </PageShell>
  );
}

const styles = StyleSheet.create({
  formIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clear: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: CLEAR_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
