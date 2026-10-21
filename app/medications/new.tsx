import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { MedicationForm } from '@/components/takt/medication-form';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useCreateMedicationPlan, useEnsurePatient } from '@/lib/hooks/use-takt-mutations';
import { useLocale } from '@/lib/takt/l10n';
import { normalizeWeekdayCodes } from '@/lib/takt/time';
import {
  EMPTY_MEDICATION_FORM,
  formatStrength,
  parseSupply,
  scheduleFieldsFromForm,
  splitStrength,
  type MedicationFormValues,
} from '@/lib/takt/medication-form';
import type { IntakeInstruction, MedicationCadence, MedicationShape, MedicationUnit } from '@/lib/takt/types';

/** Optional prefill, used by "Duplicate" on the detail screen. */
type PrefillParams = {
  name?: string;
  form?: string;
  strength?: string;
  times?: string;
  cadence?: MedicationCadence;
  days?: string;
  intervalDays?: string;
  intervalStart?: string;
  startDate?: string;
  endDate?: string;
  dosageQuantity?: string;
  dosageUnit?: MedicationUnit;
  maxPerDay?: string;
  instruction?: IntakeInstruction;
  instructionNote?: string;
  shape?: MedicationShape;
  color?: string;
};

export default function AddMedicationScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const params = useLocalSearchParams<PrefillParams>();
  const patient = usePrimaryPatient();
  const ensurePatient = useEnsurePatient();
  const createPlan = useCreateMedicationPlan();
  const [error, setError] = useState<string | null>(null);

  const initialValues = useMemo<MedicationFormValues>(() => {
    if (!params.name) return EMPTY_MEDICATION_FORM;
    const split = splitStrength(params.strength ?? '');
    return {
      ...EMPTY_MEDICATION_FORM,
      name: params.name,
      form: params.form || EMPTY_MEDICATION_FORM.form,
      strength: split.strength,
      unit: split.unit,
      times: params.times ? params.times.split(',').filter(Boolean) : EMPTY_MEDICATION_FORM.times,
      cadence: params.cadence ?? 'daily',
      days: params.days ? normalizeWeekdayCodes(params.days.split(',').filter(Boolean)) : EMPTY_MEDICATION_FORM.days,
      intervalDays: params.intervalDays ?? EMPTY_MEDICATION_FORM.intervalDays,
      intervalStart: params.intervalStart ?? EMPTY_MEDICATION_FORM.intervalStart,
      startDate: params.startDate ?? EMPTY_MEDICATION_FORM.startDate,
      endDate: params.endDate ?? EMPTY_MEDICATION_FORM.endDate,
      dosageQuantity: params.dosageQuantity ?? EMPTY_MEDICATION_FORM.dosageQuantity,
      dosageUnit: params.dosageUnit ?? EMPTY_MEDICATION_FORM.dosageUnit,
      maxPerDay: params.maxPerDay ?? EMPTY_MEDICATION_FORM.maxPerDay,
      instruction: params.instruction ?? '',
      instructionNote: params.instructionNote ?? '',
      shape: params.shape ?? EMPTY_MEDICATION_FORM.shape,
      color: params.color ?? EMPTY_MEDICATION_FORM.color,
    };
  }, [params]);

  const submit = async (values: MedicationFormValues) => {
    let patientRef = patient.data ? `Patient/${patient.data.id}` : null;
    if (!patientRef) {
      try {
        const created = await ensurePatient.mutateAsync();
        patientRef = `Patient/${created.id}`;
      } catch {
        setError(t('noPatientProfileYet'));
        return;
      }
    }
    setError(null);
    try {
      await createPlan.mutateAsync({
        patientRef,
        name: values.name,
        form: values.form,
        strength: formatStrength(values.strength, values.unit),
        ...scheduleFieldsFromForm(values),
        supplyCount: parseSupply(values.supply),
      });
      router.replace('/(tabs)/medications');
    } catch {
      setError(t('saveMedicationError'));
    }
  };

  return (
    <MedicationForm
      mode="create"
      initialValues={initialValues}
      onSubmit={submit}
      submitting={createPlan.isPending}
      submitError={error}
    />
  );
}
