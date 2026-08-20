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
import { WEEKDAY_ORDER, WEEKDAYS_ONLY } from '@/lib/takt/time';
import type { MedicationCadence, WeekdayCode } from '@/lib/takt/types';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parseTimeList = (raw: string): string[] => {
  const tokens = raw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  const normalized = tokens.map((token) => {
    if (!TIME_PATTERN.test(token)) return null;
    return token;
  });

  if (normalized.some((value) => value === null)) return [];

  const unique = [...new Set(normalized as string[])];
  return unique.sort((a, b) => {
    const [ah, am] = a.split(':').map((x) => Number.parseInt(x, 10));
    const [bh, bm] = b.split(':').map((x) => Number.parseInt(x, 10));
    return ah * 60 + am - (bh * 60 + bm);
  });
};

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

  const dayLabel = (day: WeekdayCode): string => {
    if (day === 'mon') return t('dayMon');
    if (day === 'tue') return t('dayTue');
    if (day === 'wed') return t('dayWed');
    if (day === 'thu') return t('dayThu');
    if (day === 'fri') return t('dayFri');
    if (day === 'sat') return t('daySat');
    return t('daySun');
  };

  return (
    <PageShell>
      <PageHeader title={t('addMedication')} subtitle={t('regimen')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
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

            <Field label={t('medicationName')}>
              <Input value={name} onChangeText={setName} placeholder="Ramipril" />
            </Field>
            <Field label={t('medicationForm')}>
              <Input value={form} onChangeText={setForm} placeholder="Tablet" />
            </Field>
            <Field label={t('medicationStrength')}>
              <Input value={strength} onChangeText={setStrength} placeholder="5 mg" />
            </Field>
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
                  labelFor={dayLabel}
                />
              </Field>
            ) : null}

            <Field label={t('medicationTimes')}>
              <Input
                value={timesInput}
                onChangeText={setTimesInput}
                placeholder="08:00, 13:00, 20:00"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
            <Field label={t('medicationSupplyOptional')}>
              <Input value={supply} onChangeText={setSupply} keyboardType="number-pad" placeholder="28" />
            </Field>
            {error ? <Text style={[typography.footnote, { color: c.destructive }]}>{error}</Text> : null}
            {createPlan.error ? (
              <Text style={[typography.footnote, { color: c.destructive }]}>{t('saveMedicationError')}</Text>
            ) : null}
            <Button
              label={t('save')}
              onPress={() => void save()}
              disabled={createPlan.isPending || patient.isLoading}
            />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
