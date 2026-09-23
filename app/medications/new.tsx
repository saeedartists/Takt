import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { MedicationForm } from '@/components/takt/medication-form';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useCreateMedicationPlan } from '@/lib/hooks/use-takt-mutations';
import { useLocale } from '@/lib/takt/l10n';
import {
  EMPTY_MEDICATION_FORM,
  parseSupply,
  scheduleFieldsFromForm,
  type MedicationFormValues,
} from '@/lib/takt/medication-form';
import type { IntakeInstruction, MedicationCadence, MedicationShape, WeekdayCode } from '@/lib/takt/types';

/** Optional prefill, used by "Duplicate" on the detail screen. */
type PrefillParams = {
  name?: string;
  form?: string;
  strength?: string;
  times?: string;
  cadence?: MedicationCadence;
  days?: string;
  intervalDays?: string;
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
  const createPlan = useCreateMedicationPlan();
  const [error, setError] = useState<string | null>(null);

  const initialValues = useMemo<MedicationFormValues>(() => {
    if (!params.name) return EMPTY_MEDICATION_FORM;
    return {
      ...EMPTY_MEDICATION_FORM,
      name: params.name,
      form: params.form || EMPTY_MEDICATION_FORM.form,
      strength: params.strength ?? '',
      times: params.times ? params.times.split(',').filter(Boolean) : EMPTY_MEDICATION_FORM.times,
      cadence: params.cadence ?? 'daily',
      days: params.days ? (params.days.split(',').filter(Boolean) as WeekdayCode[]) : EMPTY_MEDICATION_FORM.days,
      intervalDays: params.intervalDays ?? EMPTY_MEDICATION_FORM.intervalDays,
      instruction: params.instruction ?? '',
      instructionNote: params.instructionNote ?? '',
      shape: params.shape ?? EMPTY_MEDICATION_FORM.shape,
      color: params.color ?? EMPTY_MEDICATION_FORM.color,
    };
  }, [params]);

  const submit = async (values: MedicationFormValues) => {
    const patientRef = patient.data ? `Patient/${patient.data.id}` : null;
    if (!patientRef) {
      setError(t('noPatientProfileYet'));
      return;
    }
    setError(null);
    try {
      await createPlan.mutateAsync({
        patientRef,
        name: values.name,
        form: values.form,
        strength: values.strength,
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
