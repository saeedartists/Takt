import { useRouter } from 'expo-router';
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
  categoryColors,
  radius,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';

export default function MedicationsScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);

  const activePlans = plans.plans.filter((plan) => plan.request.status === 'active');
  const pausedPlans = plans.plans.filter((plan) => plan.request.status === 'on-hold');
  const archivedPlans = plans.plans.filter((plan) => plan.request.status === 'stopped');

  const cadenceLabel = (plan: (typeof plans.plans)[number]): string => {
    if (plan.cadence === 'daily') return t('cadenceDaily');
    if (plan.cadence === 'weekdays') return t('cadenceWeekdays');
    return t('cadenceSpecificDays');
  };

  const renderList = (rows: typeof plans.plans) => (
    <ListGroup>
      {rows.map((plan, index) => (
        <ListRow
          key={plan.request.id}
          isFirst={index === 0}
          title={plan.label}
          subtitle={`${cadenceLabel(plan)} · ${plan.times.join(', ')} · ${plan.form || t('formNotSet')}`}
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
              }}
            />
          ) : plans.plans.length === 0 ? (
            <EmptyState
              title={t('noMedsYet')}
              description={t('addMedicationCadenceHint')}
              action={<Button label={t('addMedication')} onPress={() => router.push('/medications/new')} />}
            />
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
