import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
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
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useCreateMedicationPlan } from '@/lib/hooks/use-takt-mutations';
import { useLocale } from '@/lib/takt/l10n';
import { formatDayLabel, normalizeTimesInput, parseTimeList } from '@/lib/takt/medication-form';
import { WEEKDAY_ORDER, WEEKDAYS_ONLY } from '@/lib/takt/time';
import type { MedicationCadence, WeekdayCode } from '@/lib/takt/types';

export default function AddMedicationScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();

  const patient = usePrimaryPatient();
  const createPlan = useCreateMedicationPlan();

  const [name, setName] = useState('');
  const [form, setForm] = useState('Tablet');
  const [strength, setStrength] = useState('5 mg');
  const [timesInput, setTimesInput] = useState('08:00');
  const [cadence, setCadence] = useState<MedicationCadence>('daily');
  const [selectedDays, setSelectedDays] = useState<WeekdayCode[]>(WEEKDAYS_ONLY);
  const [supply, setSupply] = useState('28');
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: WeekdayCode) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((entry) => entry !== day) : [...prev, day],
    );
  };

  const save = async () => {
    const patientRef = patient.data ? `Patient/${patient.data.id}` : null;
    if (!patientRef) {
      setError(t('noPatientProfileYet'));
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

    setError(null);

    const parsedSupply = Number.parseInt(supply, 10);
    const supplyCount = Number.isFinite(parsedSupply) && parsedSupply > 0 ? parsedSupply : undefined;

    try {
      await createPlan.mutateAsync({
        patientRef,
        name,
        form,
        strength,
        cadence,
        dayOfWeek,
        times,
        supplyCount,
      });

      router.replace('/(tabs)/medications');
    } catch {
      setError(t('saveMedicationError'));
    }
  };

  return (
    <PageShell>
      <PageHeader title={t('addMedication')} subtitle={t('medicationSetupSubtitle')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(4) }}>
            <View style={{ flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' }}>
              <Badge label={t('statusActive')} tone="success" />
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

            {error ? <Text style={[typography.footnote, { color: c.destructive }]}>{error}</Text> : null}
            {createPlan.error ? (
              <Text style={[typography.footnote, { color: c.destructive }]}>{t('saveMedicationError')}</Text>
            ) : null}
            <Button
              label={createPlan.isPending ? t('savingMedication') : t('save')}
              onPress={() => void save()}
              disabled={createPlan.isPending || patient.isLoading}
            />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
