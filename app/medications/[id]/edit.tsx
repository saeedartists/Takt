import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, PageShell, SkeletonCard, Stack } from '@/components/ui';
import { MedicationForm } from '@/components/takt/medication-form';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useUpdateMedicationPlan } from '@/lib/hooks/use-takt-mutations';
import { useLocale } from '@/lib/takt/l10n';
import {
  EMPTY_MEDICATION_FORM,
  normalizeDateInput,
  parseSupply,
  scheduleFieldsFromForm,
  type MedicationFormValues,
  type MedicationStatus,
} from '@/lib/takt/medication-form';
import { getDaysUntilRefill, getLastRefilledAt, getSupplyCount } from '@/lib/takt/supply-tracker';

const toStatus = (status: string): MedicationStatus =>
  status === 'on-hold' || status === 'stopped' ? status : 'active';

export default function EditMedicationScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const updatePlan = useUpdateMedicationPlan();

  const plan = useMemo(() => plans.plans.find((entry) => entry.request.id === id), [id, plans.plans]);

  const [initial, setInitial] = useState<MedicationFormValues | null>(null);
  const [daysUntilRefill, setDaysUntilRefill] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Supply lives in local storage; seed the form once both sources are in.
  useEffect(() => {
    if (!plan || initial) return;
    const medicationId = plan.medication?.id;
    let active = true;
    void (async () => {
      const [count, refilledAt, days] = medicationId
        ? await Promise.all([getSupplyCount(medicationId), getLastRefilledAt(medicationId), getDaysUntilRefill(medicationId)])
        : [null, null, null];
      if (!active) return;
      setDaysUntilRefill(days);
      setInitial({
        name: plan.label,
        form: plan.form || 'Tablet',
        strength: plan.strength || '',
        times: plan.times,
        cadence: plan.cadence,
        days: plan.dayOfWeek,
        supply:
          typeof count === 'number'
            ? count.toString()
            : typeof plan.supplyCount === 'number'
              ? Math.round(plan.supplyCount).toString()
              : '',
        status: toStatus(plan.request.status),
        lastRefilled: refilledAt ? refilledAt.slice(0, 10) : '',
        intervalDays: plan.intervalDays ? String(plan.intervalDays) : EMPTY_MEDICATION_FORM.intervalDays,
        intervalStart: plan.intervalStart ?? '',
        endDate: plan.endDate ?? '',
        maxPerDay: plan.maxPerDay ? String(plan.maxPerDay) : '',
        instruction: plan.instruction ?? '',
        instructionNote: plan.instructionNote ?? '',
        shape: plan.appearance?.shape ?? EMPTY_MEDICATION_FORM.shape,
        color: plan.appearance?.color ?? EMPTY_MEDICATION_FORM.color,
      });
    })();
    return () => {
      active = false;
    };
  }, [plan, initial]);

  const submit = async (values: MedicationFormValues) => {
    if (!plan || !patientRef || !plan.medication) {
      setError(t('medicationNotFoundHint'));
      return;
    }
    setError(null);
    try {
      await updatePlan.mutateAsync({
        patientRef,
        name: values.name,
        form: values.form,
        strength: values.strength,
        ...scheduleFieldsFromForm(values),
        supplyCount: parseSupply(values.supply),
        lastRefilledDate: normalizeDateInput(values.lastRefilled) ?? '',
        status: values.status,
        request: plan.request,
        medication: plan.medication,
      });
      router.replace({ pathname: '/medications/[id]', params: { id: plan.request.id } });
    } catch {
      setError(t('saveChangesError'));
    }
  };

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

  if (!patient.isLoading && !plans.isLoading && (!plan || !plan.medication)) {
    return (
      <PageShell>
        <EmptyState title={t('medicationNotFound')} description={t('medicationNotFoundHint')} />
      </PageShell>
    );
  }

  if (!initial) {
    return (
      <PageShell>
        <Stack>
          <SkeletonCard rows={2} />
          <SkeletonCard rows={1} />
        </Stack>
      </PageShell>
    );
  }

  return (
    <MedicationForm
      mode="edit"
      initialValues={initial}
      onSubmit={submit}
      submitting={updatePlan.isPending}
      submitError={error}
      supplyHint={`${t('supplyDaysUntilRefill')}: ${typeof daysUntilRefill === 'number' ? daysUntilRefill : '—'}`}
    />
  );
}
