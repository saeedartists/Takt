import { useRouter } from 'expo-router';
import { useState } from 'react';
import { MedicationForm } from '@/components/takt/medication-form';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useCreateMedicationPlan } from '@/lib/hooks/use-takt-mutations';
import { useLocale } from '@/lib/takt/l10n';
import {
  EMPTY_MEDICATION_FORM,
  parseSupply,
  resolveDayOfWeek,
  type MedicationFormValues,
} from '@/lib/takt/medication-form';

export default function AddMedicationScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const patient = usePrimaryPatient();
  const createPlan = useCreateMedicationPlan();
  const [error, setError] = useState<string | null>(null);

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
        cadence: values.cadence,
        dayOfWeek: resolveDayOfWeek(values.cadence, values.days),
        times: values.times,
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
      initialValues={EMPTY_MEDICATION_FORM}
      onSubmit={submit}
      submitting={createPlan.isPending}
      submitError={error}
    />
  );
}
