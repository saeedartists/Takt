import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedPressable,
  AnimatedSegmentedControl,
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
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';
import { buildDoseOccurrencesForDay } from '@/lib/takt/schedule';
import { getSupplyCount } from '@/lib/takt/supply-tracker';
import { startOfDay } from '@/lib/takt/time';
import type { MedicationPlan } from '@/lib/takt/types';

const SUPPLY_LOW_THRESHOLD = 7;
const CLEAR_HIT = 44;

type SupplyMap = Record<string, number | null>;
type StatusFilter = 'all' | 'active' | 'paused' | 'archived';

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
  const { t, formatTime } = useLocale();
  const { enter } = useMotion();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [supplyByMedication, setSupplyByMedication] = useState<SupplyMap>({});

  const isLoading = patient.isLoading || plans.isLoading;
  // Stagger rows once, on the first render that has data; filter/search changes only re-layout.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (!isLoading) firstLoad.current = false;
  }, [isLoading]);

  const refreshSupply = useCallback(async () => {
    const next: SupplyMap = {};
    for (const plan of plans.plans) {
      const medicationId = plan.medication?.id;
      if (!medicationId) continue;
      next[medicationId] = await getSupplyCount(medicationId);
    }
    setSupplyByMedication(next);
  }, [plans.plans]);

  useFocusEffect(
    useCallback(() => {
      void refreshSupply();
    }, [refreshSupply]),
  );

  // First still-open dose today per request, for the "Next today" line.
  const nextTodayByRequest = useMemo(() => {
    const now = new Date();
    const doses = buildDoseOccurrencesForDay(
      plans.plans,
      (events.data?.entry ?? []).map((x) => x.resource),
      startOfDay(now),
      now,
    );
    const next = new Map<string, Date>();
    for (const dose of doses) {
      if ((dose.state === 'scheduled' || dose.state === 'due') && !next.has(dose.requestId)) {
        next.set(dose.requestId, dose.scheduledAt);
      }
    }
    return next;
  }, [events.data?.entry, plans.plans]);

  const filteredPlans = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return plans.plans.filter((plan) => {
      if (statusFilter === 'active' && plan.request.status !== 'active') return false;
      if (statusFilter === 'paused' && plan.request.status !== 'on-hold') return false;
      if (statusFilter === 'archived' && plan.request.status !== 'stopped') return false;

      if (!search) return true;
      const hay = `${plan.label} ${plan.form ?? ''} ${plan.strength ?? ''}`.toLowerCase();
      return hay.includes(search);
    });
  }, [plans.plans, searchTerm, statusFilter]);

  const activePlans = filteredPlans.filter((plan) => plan.request.status === 'active');
  const pausedPlans = filteredPlans.filter((plan) => plan.request.status === 'on-hold');
  const archivedPlans = filteredPlans.filter((plan) => plan.request.status === 'stopped');

  const cadenceLabel = (plan: MedicationPlan): string => {
    if (plan.cadence === 'daily') return t('cadenceDaily');
    if (plan.cadence === 'weekdays') return t('cadenceWeekdays');
    return t('cadenceSpecificDays');
  };

  const statusTint = (plan: MedicationPlan): string =>
    plan.request.status === 'active' ? c.accent : plan.request.status === 'on-hold' ? c.warning : c.textTertiary;

  // Third line: low-supply chip wins, otherwise the next open dose today.
  const rowMeta = (plan: MedicationPlan) => {
    const medicationId = plan.medication?.id;
    const count = medicationId ? supplyByMedication[medicationId] : undefined;

    if (typeof count === 'number' && count <= 0) {
      return <Badge label={t('supplyRefillNeeded')} tone="destructive" />;
    }
    if (typeof count === 'number' && count <= SUPPLY_LOW_THRESHOLD) {
      return (
        <Badge
          label={`${t('supplyLow')} · ${t('supplyRemaining').replace('{count}', count.toString())}`}
          tone="warning"
        />
      );
    }

    const next = nextTodayByRequest.get(plan.request.id);
    return next ? t('medsNextToday').replace('{time}', formatTime(next)) : undefined;
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
              subtitle={[cadenceLabel(plan), plan.times.join(', '), plan.strength || plan.form || t('formNotSet')].join(' · ')}
              meta={rowMeta(plan)}
              leading={
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: radius.md,
                    backgroundColor: `${tint}1A`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={getFormIconName(plan.form)} size={16} color={tint} />
                </View>
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
        action={<Button label={t('addMedication')} onPress={() => router.push('/medications/new')} />}
      />

      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.headline, { color: c.textSecondary }]}>{t('regimen')}</Text>
            <View style={{ flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' }}>
              <Badge label={`${activePlans.length.toString()} ${t('activeMeds')}`} tone="success" />
              <Badge label={`${pausedPlans.length.toString()} ${t('pausedMeds')}`} tone="warning" />
              <Badge label={`${archivedPlans.length.toString()} ${t('archivedMeds')}`} tone="destructive" />
            </View>
            <Button kind="secondary" label={t('openReport')} onPress={() => router.push('/report')} />
          </View>
        </Card>

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
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
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: CLEAR_HIT,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close-circle" size={18} color={c.textTertiary} />
                </AnimatedPressable>
              ) : null}
            </View>
            <AnimatedSegmentedControl
              value={statusFilter}
              onChange={(next) => setStatusFilter(next as StatusFilter)}
              options={[
                { value: 'all', label: t('medsFilterAll') },
                { value: 'active', label: t('medsFilterActive') },
                { value: 'paused', label: t('medsFilterPaused') },
                { value: 'archived', label: t('medsFilterArchived') },
              ]}
            />
          </View>
        </Card>

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
                  <SectionHeader title={t('activeMeds')} />
                  {renderList(activePlans, 0)}
                </View>
              ) : null}

              {pausedPlans.length > 0 ? (
                <View>
                  <SectionHeader title={t('pausedMeds')} />
                  {renderList(pausedPlans, activePlans.length)}
                </View>
              ) : null}

              {archivedPlans.length > 0 ? (
                <View>
                  <SectionHeader title={t('archivedMeds')} />
                  {renderList(archivedPlans, activePlans.length + pausedPlans.length)}
                </View>
              ) : null}
            </Stack>
          )}
        </View>
      </Stack>
    </PageShell>
  );
}
