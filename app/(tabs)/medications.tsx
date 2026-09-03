import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListGroup,
  ListRow,
  LoadingState,
  PageHeader,
  PageShell,
  SectionHeader,
  SegmentedControl,
  Stack,
  categoryColors,
  radius,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';
import { getSupplyCount } from '@/lib/takt/supply-tracker';

const SUPPLY_LOW_THRESHOLD = 7;

type SupplyMap = Record<string, number | null>;

export default function MedicationsScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all');
  const [supplyByMedication, setSupplyByMedication] = useState<SupplyMap>({});

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

  const cadenceLabel = (plan: (typeof plans.plans)[number]): string => {
    if (plan.cadence === 'daily') return t('cadenceDaily');
    if (plan.cadence === 'weekdays') return t('cadenceWeekdays');
    return t('cadenceSpecificDays');
  };

  const supplyBadge = (plan: (typeof plans.plans)[number]) => {
    const medicationId = plan.medication?.id;
    if (!medicationId) return null;

    const count = supplyByMedication[medicationId];
    if (typeof count !== 'number') return null;

    if (count <= 0) {
      return <Badge label={t('supplyRefillNeeded')} tone="destructive" />;
    }

    if (count <= SUPPLY_LOW_THRESHOLD) {
      return (
        <Badge
          label={`${t('supplyLow')} · ${t('supplyRemaining').replace('{count}', count.toString())}`}
          tone="warning"
        />
      );
    }

    return <Badge label={t('supplyRemaining').replace('{count}', count.toString())} tone="neutral" />;
  };

  const renderList = (rows: typeof plans.plans) => (
    <ListGroup>
      {rows.map((plan, index) => (
        <ListRow
          key={plan.request.id}
          isFirst={index === 0}
          title={plan.label}
          subtitle={`${cadenceLabel(plan)} · ${plan.times.join(', ')} · ${plan.form || t('formNotSet')}`}
          trailing={supplyBadge(plan) ?? undefined}
          leading={
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: radius.full,
                backgroundColor: `${categoryColors.medication}1F`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[typography.caption, { color: categoryColors.medication, fontWeight: '700' }]}>M</Text>
            </View>
          }
          onPress={() => router.push({ pathname: '/medications/[id]', params: { id: plan.request.id } })}
        />
      ))}
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
            <Input
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder={t('medsSearchPlaceholder')}
              returnKeyType="search"
            />
            <SegmentedControl
              value={statusFilter}
              onChange={(next) => setStatusFilter(next as 'all' | 'active' | 'paused' | 'archived')}
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
          {patient.isLoading || plans.isLoading ? (
            <LoadingState label={t('loadingMeds')} />
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
                  {renderList(activePlans)}
                </View>
              ) : null}

              {pausedPlans.length > 0 ? (
                <View>
                  <SectionHeader title={t('pausedMeds')} />
                  {renderList(pausedPlans)}
                </View>
              ) : null}

              {archivedPlans.length > 0 ? (
                <View>
                  <SectionHeader title={t('archivedMeds')} />
                  {renderList(archivedPlans)}
                </View>
              ) : null}
            </Stack>
          )}
        </View>
      </Stack>
    </PageShell>
  );
}
