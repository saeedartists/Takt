import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  PageShell,
  SectionHeader,
  SegmentedControl,
  Stack,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import { WeekdayPicker } from '@/components/takt/weekday-picker';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useUpdateMedicationPlan } from '@/lib/hooks/use-takt-mutations';
import { useLocale } from '@/lib/takt/l10n';
import { formatDayLabel, normalizeTimesInput, parseTimeList } from '@/lib/takt/medication-form';
import { WEEKDAY_ORDER, WEEKDAYS_ONLY } from '@/lib/takt/time';
import type { MedicationCadence, WeekdayCode } from '@/lib/takt/types';

const statusToFilter = (status: string): 'active' | 'on-hold' | 'stopped' => {
  if (status === 'on-hold') return 'on-hold';
  if (status === 'stopped') return 'stopped';
  return 'active';
};

export default function EditMedicationScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const updateMedicationPlan = useUpdateMedicationPlan();

  const plan = useMemo(() => plans.plans.find((entry) => entry.request.id === id), [id, plans.plans]);

  const [name, setName] = useState('');
  const [form, setForm] = useState('');
  const [strength, setStrength] = useState('');
  const [timesInput, setTimesInput] = useState('');
  const [cadence, setCadence] = useState<MedicationCadence>('daily');
  const [selectedDays, setSelectedDays] = useState<WeekdayCode[]>(WEEKDAYS_ONLY);
  const [status, setStatus] = useState<'active' | 'on-hold' | 'stopped'>('active');
  const [supply, setSupply] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) return;

    setName(plan.label);
    setForm(plan.form || 'Tablet');
    setStrength(plan.strength || '');
    setTimesInput(plan.times.join(', '));
    setCadence(plan.cadence);
    setSelectedDays(plan.dayOfWeek);
    setStatus(statusToFilter(plan.request.status));
    setSupply(typeof plan.supplyCount === 'number' ? Math.round(plan.supplyCount).toString() : '');
  }, [plan]);

  const toggleDay = (day: WeekdayCode) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((entry) => entry !== day) : [...prev, day],
    );
  };

  const saveChanges = async () => {
    if (!plan || !patientRef || !plan.medication) {
      setError(t('medicationNotFoundHint'));
      return;
    }

    if (!name.trim()) {
      setError(t('addMedicationNameError'));
      return;
    }

    const times = parseTimeList(timesInput);
    if (times.length === 0) {
      setError(t('invalidTimesError'));
      return;
    }

    if (cadence === 'custom' && selectedDays.length === 0) {
      setError(t('selectAtLeastOneDayError'));
      return;
    }

    const dayOfWeek =
      cadence === 'daily' ? WEEKDAY_ORDER : cadence === 'weekdays' ? WEEKDAYS_ONLY : selectedDays;

    const parsedSupply = Number.parseInt(supply, 10);
    const supplyCount = Number.isFinite(parsedSupply) && parsedSupply > 0 ? parsedSupply : undefined;

    setError(null);

    try {
      await updateMedicationPlan.mutateAsync({
        patientRef,
        name,
        form,
        strength,
        cadence,
        dayOfWeek,
        times,
        supplyCount,
        status,
        request: plan.request,
        medication: plan.medication,
      });

      router.replace({ pathname: '/medications/[id]', params: { id: plan.request.id } });
    } catch {
      setError(t('saveChangesError'));
    }
  };

  if (patient.isLoading || plans.isLoading) {
    return (
      <PageShell>
        <LoadingState label={t('loadingMedication')} />
      </PageShell>
    );
  }

  if (patient.error || plans.error) {
    return (
      <PageShell>
        <ErrorState
          description={t('loadMedicationsError')}
          onRetry={() => {
            void patient.refetch();
            void plans.requestsQuery.refetch();
            void plans.medicationsQuery.refetch();
          }}
        />
      </PageShell>
    );
  }

  if (!plan || !plan.medication) {
    return (
      <PageShell>
        <EmptyState title={t('medicationNotFound')} description={t('medicationNotFoundHint')} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title={t('editMedicationRouteTitle')} subtitle={t('medicationEditSubtitle')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(4) }}>
            <View style={{ flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' }}>
              <Badge
                label={
                  cadence === 'daily'
                    ? t('cadenceDaily')
                    : cadence === 'weekdays'
                      ? t('cadenceWeekdays')
                      : t('cadenceSpecificDays')
                }
                tone="accent"
              />
              <Badge
                label={status === 'active' ? t('statusActive') : status === 'on-hold' ? t('statusPaused') : t('statusArchived')}
                tone={status === 'active' ? 'success' : status === 'on-hold' ? 'warning' : 'destructive'}
              />
            </View>

            <View style={{ gap: spacing(3) }}>
              <SectionHeader title={t('medicationIdentitySectionTitle')} />
              <Field label={t('medicationName')}>
                <Input value={name} onChangeText={setName} placeholder={t('medicationNamePlaceholder')} />
              </Field>
              <Field label={t('medicationForm')}>
                <Input value={form} onChangeText={setForm} placeholder={t('medicationFormPlaceholder')} />
              </Field>
              <Field label={t('medicationStrength')}>
                <Input value={strength} onChangeText={setStrength} placeholder={t('medicationStrengthPlaceholder')} />
              </Field>
            </View>

            <View style={{ gap: spacing(3) }}>
              <SectionHeader title={t('medicationScheduleSectionTitle')} />
              <Field label={t('medicationCadence')}>
                <SegmentedControl
                  value={cadence}
                  onChange={(next) => setCadence(next as MedicationCadence)}
                  options={[
                    { value: 'daily', label: t('cadenceDaily') },
                    { value: 'weekdays', label: t('cadenceWeekdays') },
                    { value: 'custom', label: t('cadenceSpecificDays') },
                  ]}
                />
              </Field>

              {cadence === 'custom' ? (
                <Field label={t('specificDaysLabel')}>
                  <WeekdayPicker
                    days={WEEKDAY_ORDER}
                    selected={selectedDays}
                    onToggle={toggleDay}
                    labelFor={(day) => formatDayLabel(day, t)}
                  />
                </Field>
              ) : null}

              <Field label={t('medicationTimes')}>
                <Input
                  value={timesInput}
                  onChangeText={setTimesInput}
                  onBlur={() => {
                    const normalized = normalizeTimesInput(timesInput);
                    if (normalized) setTimesInput(normalized);
                  }}
                  placeholder={t('medicationTimesPlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Field>
              <Text style={[typography.caption, { color: c.textSecondary }]}>{t('medicationTimesHint')}</Text>
            </View>

            <View style={{ gap: spacing(3) }}>
              <SectionHeader title={t('medicationSupplySectionTitle')} />
              <Field label={t('medicationSupplyOptional')}>
                <Input
                  value={supply}
                  onChangeText={setSupply}
                  keyboardType="number-pad"
                  placeholder={t('medicationSupplyPlaceholder')}
                />
              </Field>
            </View>

            <View style={{ gap: spacing(3) }}>
              <SectionHeader title={t('statusLabel')} />
              <SegmentedControl
                value={status}
                onChange={(next) => setStatus(next as 'active' | 'on-hold' | 'stopped')}
                options={[
                  { value: 'active', label: t('statusActive') },
                  { value: 'on-hold', label: t('statusPaused') },
                  { value: 'stopped', label: t('statusArchived') },
                ]}
              />
            </View>

            {error ? <Text style={[typography.footnote, { color: c.destructive }]}>{error}</Text> : null}
            {updateMedicationPlan.error ? (
              <Text style={[typography.footnote, { color: c.destructive }]}>{t('saveChangesError')}</Text>
            ) : null}

            <Button
              label={updateMedicationPlan.isPending ? t('savingMedicationChanges') : t('saveChanges')}
              onPress={() => void saveChanges()}
              disabled={updateMedicationPlan.isPending}
            />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
