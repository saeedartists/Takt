import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  PageShell,
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

export default function EditMedicationScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const updatePlan = useUpdateMedicationPlan();

  const plan = useMemo(() => plans.plans.find((entry) => entry.request.id === id), [id, plans.plans]);

  const [name, setName] = useState('');
  const [form, setForm] = useState('');
  const [strength, setStrength] = useState('');
  const [timesInput, setTimesInput] = useState('08:00');
  const [cadence, setCadence] = useState<MedicationCadence>('daily');
  const [selectedDays, setSelectedDays] = useState<WeekdayCode[]>(WEEKDAYS_ONLY);
  const [supply, setSupply] = useState('');
  const [status, setStatus] = useState<'active' | 'on-hold' | 'stopped'>('active');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) return;
    setName(plan.label);
    setForm(plan.form || 'Tablet');
    setStrength(plan.strength || '');
    setTimesInput(plan.times.join(', '));
    setCadence(plan.cadence);
    setSelectedDays(plan.dayOfWeek);
    setSupply(typeof plan.supplyCount === 'number' ? Math.round(plan.supplyCount).toString() : '');
    if (plan.request.status === 'on-hold' || plan.request.status === 'stopped') {
      setStatus(plan.request.status);
    } else {
      setStatus('active');
    }
  }, [plan]);

  const toggleDay = (day: WeekdayCode) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((entry) => entry !== day) : [...prev, day],
    );
  };

  if (patient.isLoading || plans.isLoading) {
    return (
      <PageShell>
        <LoadingState label={t('loadingMedication')} />
      </PageShell>
    );
  }

  if (!plan || !plan.medication || !patientRef) {
    return (
      <PageShell>
        <EmptyState title={t('medicationNotFound')} description={t('medicationNotFoundHint')} />
      </PageShell>
    );
  }

  const save = async () => {
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
    await updatePlan.mutateAsync({
      patientRef,
      name,
      form,
      strength,
      cadence,
      dayOfWeek,
      times,
      supplyCount: supply ? Number.parseInt(supply, 10) : undefined,
      status,
      request: plan.request,
      medication: plan.medication!,
    });
    router.replace('/(tabs)/medications');
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
      <PageHeader title={name || t('medications')} subtitle={t('regimen')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <View style={{ flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' }}>
              <Badge
                label={
                  status === 'active' ? t('statusActive') : status === 'on-hold' ? t('statusPaused') : t('statusArchived')
                }
                tone={status === 'active' ? 'success' : status === 'on-hold' ? 'warning' : 'destructive'}
              />
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
              <Input value={name} onChangeText={setName} />
            </Field>
            <Field label={t('medicationForm')}>
              <Input value={form} onChangeText={setForm} />
            </Field>
            <Field label={t('medicationStrength')}>
              <Input value={strength} onChangeText={setStrength} />
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
            <Field label={t('medicationSupply')}>
              <Input value={supply} onChangeText={setSupply} keyboardType="number-pad" />
            </Field>
            <Field label={t('statusLabel')}>
              <SegmentedControl
                value={status}
                onChange={(next) => setStatus(next as 'active' | 'on-hold' | 'stopped')}
                options={[
                  { value: 'active', label: t('statusActive') },
                  { value: 'on-hold', label: t('statusPaused') },
                  { value: 'stopped', label: t('statusArchived') },
                ]}
              />
            </Field>

            {error ? <Text style={[typography.footnote, { color: c.destructive }]}>{error}</Text> : null}
            {updatePlan.error ? (
              <Text style={[typography.footnote, { color: c.destructive }]}>{t('saveChangesError')}</Text>
            ) : null}

            <Button label={t('saveChanges')} onPress={() => void save()} disabled={updatePlan.isPending} />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
