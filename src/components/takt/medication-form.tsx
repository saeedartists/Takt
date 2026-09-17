import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedPressable,
  Button,
  Card,
  CONTENT_MAX_WIDTH,
  Field,
  Input,
  PageShell,
  SectionHeader,
  SegmentedControl,
  Stack,
  motion,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { TimeField } from '@/components/takt/time-field';
import { WeekdayPicker } from '@/components/takt/weekday-picker';
import { useLocale } from '@/lib/takt/l10n';
import {
  FORM_PRESETS,
  SUPPLY_PRESETS,
  TIME_PRESETS,
  formatDayLabel,
  isClockTime,
  validateMedicationForm,
  type MedicationFormErrors,
  type MedicationFormValues,
  type MedicationStatus,
} from '@/lib/takt/medication-form';
import { sortTimes, WEEKDAY_ORDER } from '@/lib/takt/time';
import type { MedicationCadence, WeekdayCode } from '@/lib/takt/types';

const FORM_LABEL_KEY = {
  Tablet: 'formTablet',
  Capsule: 'formCapsule',
  Drops: 'formDrops',
  Inhaler: 'formInhaler',
  Syrup: 'formSyrup',
} as const;

const isPreset = (form: string): boolean =>
  FORM_PRESETS.some((preset) => preset.toLowerCase() === form.trim().toLowerCase());

const expand = LinearTransition.springify()
  .damping(motion.spring.gentle.damping)
  .stiffness(motion.spring.gentle.stiffness);

/** Selectable pill used for form, time, supply and refill amounts. */
export const Chip = ({
  label,
  selected = false,
  onPress,
  accessibilityLabel,
  trailing,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  trailing?: ReactNode;
}) => {
  const { c } = useTokens();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={4}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? `${c.accent}20` : c.surfaceRaised,
          borderColor: selected ? c.accent : c.separator,
        },
      ]}
    >
      <Text
        style={[
          typography.subhead,
          { color: selected ? c.accent : c.textSecondary, fontWeight: selected ? '600' : '500', fontVariant: ['tabular-nums'] },
        ]}
      >
        {label}
      </Text>
      {trailing}
    </AnimatedPressable>
  );
};

type Props = {
  mode: 'create' | 'edit';
  initialValues: MedicationFormValues;
  onSubmit: (values: MedicationFormValues) => Promise<void>;
  submitting: boolean;
  /** Screen-level failure (network, missing patient) shown above Save. */
  submitError?: string | null;
  /** Edit only: quiet line under the supply field, e.g. days until refill. */
  supplyHint?: string;
};

export const MedicationForm = ({ mode, initialValues, onSubmit, submitting, submitError, supplyHint }: Props) => {
  const { c } = useTokens();
  const { t } = useLocale();
  const { enter, duration } = useMotion();
  const insets = useSafeAreaInsets();

  const [values, setValues] = useState<MedicationFormValues>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<keyof MedicationFormErrors, boolean>>>({});
  const [otherForm, setOtherForm] = useState(() => !isPreset(initialValues.form));
  const [addingTime, setAddingTime] = useState(false);
  const [draftTime, setDraftTime] = useState('08:00');

  const set = <K extends keyof MedicationFormValues>(key: K, value: MedicationFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));
  const touch = (key: keyof MedicationFormErrors) => setTouched((prev) => ({ ...prev, [key]: true }));

  const errors = useMemo(() => validateMedicationForm(values, t), [values, t]);
  const isValid = Object.keys(errors).length === 0;
  const shown = (key: keyof MedicationFormErrors) => (touched[key] ? errors[key] : undefined);

  const removeTime = (time: string) => {
    set('times', values.times.filter((entry) => entry !== time));
    touch('times');
  };
  const addTime = (time: string) => {
    set('times', sortTimes([...new Set([...values.times, time])]));
    touch('times');
  };
  const commitDraft = () => {
    if (!isClockTime(draftTime)) return;
    addTime(draftTime);
    setAddingTime(false);
  };

  const toggleDay = (day: WeekdayCode) => {
    set('days', values.days.includes(day) ? values.days.filter((entry) => entry !== day) : [...values.days, day]);
    touch('days');
  };

  const submit = async () => {
    setTouched({ name: true, times: true, days: true, lastRefilled: true });
    if (!isValid || submitting) return;
    await onSubmit({ ...values, name: values.name.trim(), form: values.form.trim(), times: sortTimes(values.times) });
  };

  const timeChips = [...values.times, ...TIME_PRESETS.filter((preset) => !values.times.includes(preset))];

  const saveBar = (
    <View
      style={[
        styles.bar,
        { backgroundColor: c.surface, borderTopColor: c.separator, paddingBottom: spacing(3) + insets.bottom },
      ]}
    >
      <View style={styles.barInner}>
        {submitError ? (
          <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>
            {submitError}
          </Text>
        ) : null}
        <Button
          label={mode === 'create' ? t('save') : t('saveChanges')}
          onPress={() => void submit()}
          disabled={!isValid}
          loading={submitting}
          haptic="success"
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <PageShell>
        <Stack>
          {/* Identity */}
          <Animated.View entering={enter(0)} layout={expand}>
            <SectionHeader title={t('medicationIdentitySectionTitle')} />
            <Card>
              <View style={styles.cardBody}>
                <Field label={t('medicationName')} error={shown('name')}>
                  <Input
                    value={values.name}
                    onChangeText={(next) => set('name', next)}
                    onBlur={() => touch('name')}
                    placeholder={t('medicationNamePlaceholder')}
                    invalid={Boolean(shown('name'))}
                    autoCapitalize="words"
                  />
                </Field>

                <Field label={t('medicationForm')}>
                  <Animated.View layout={expand} style={styles.chips}>
                    {FORM_PRESETS.map((preset) => (
                      <Chip
                        key={preset}
                        label={t(FORM_LABEL_KEY[preset])}
                        selected={!otherForm && values.form.toLowerCase() === preset.toLowerCase()}
                        onPress={() => {
                          setOtherForm(false);
                          set('form', preset);
                        }}
                      />
                    ))}
                    <Chip
                      label={t('formOther')}
                      selected={otherForm}
                      onPress={() => {
                        setOtherForm(true);
                        if (isPreset(values.form)) set('form', '');
                      }}
                    />
                  </Animated.View>
                  {otherForm ? (
                    <Animated.View entering={FadeIn.duration(duration.fast)} exiting={FadeOut.duration(duration.fast)}>
                      <Input
                        value={values.form}
                        onChangeText={(next) => set('form', next)}
                        placeholder={t('medicationFormOtherPlaceholder')}
                        autoFocus={!values.form}
                      />
                    </Animated.View>
                  ) : null}
                </Field>

                <Field label={t('medicationStrength')}>
                  <Input
                    value={values.strength}
                    onChangeText={(next) => set('strength', next)}
                    placeholder={t('medicationStrengthPlaceholder')}
                  />
                </Field>
              </View>
            </Card>
          </Animated.View>

          {/* Schedule */}
          <Animated.View entering={enter(1)} layout={expand}>
            <SectionHeader title={t('medicationScheduleSectionTitle')} />
            <Card>
              <View style={styles.cardBody}>
                <Field label={t('medicationCadence')} error={shown('days')}>
                  <SegmentedControl
                    value={values.cadence}
                    onChange={(next) => set('cadence', next as MedicationCadence)}
                    options={[
                      { value: 'daily', label: t('cadenceDaily') },
                      { value: 'weekdays', label: t('cadenceWeekdays') },
                      { value: 'custom', label: t('cadenceSpecificDays') },
                    ]}
                  />
                  {values.cadence === 'custom' ? (
                    <Animated.View
                      entering={FadeIn.duration(duration.fast)}
                      exiting={FadeOut.duration(duration.fast)}
                      style={styles.expander}
                    >
                      <WeekdayPicker
                        days={WEEKDAY_ORDER}
                        selected={values.days}
                        onToggle={toggleDay}
                        labelFor={(day) => formatDayLabel(day, t)}
                      />
                    </Animated.View>
                  ) : null}
                </Field>

                <Field label={t('medicationTimes')} hint={t('medicationTimesHint')} error={shown('times')}>
                  <Animated.View layout={expand} style={styles.chips}>
                    {timeChips.map((time) => {
                      const selected = values.times.includes(time);
                      return (
                        <Chip
                          key={time}
                          label={time}
                          selected={selected}
                          accessibilityLabel={selected ? t('removeTimeLabel').replace('{time}', time) : time}
                          onPress={() => (selected ? removeTime(time) : addTime(time))}
                          trailing={selected ? <Ionicons name="close" size={14} color={c.accent} /> : null}
                        />
                      );
                    })}
                    {!addingTime ? (
                      <Chip
                        label={t('addTimeCta')}
                        onPress={() => {
                          setDraftTime(TIME_PRESETS.find((preset) => !values.times.includes(preset)) ?? '08:00');
                          setAddingTime(true);
                        }}
                      />
                    ) : null}
                  </Animated.View>
                  {addingTime ? (
                    <Animated.View
                      entering={FadeIn.duration(duration.fast)}
                      exiting={FadeOut.duration(duration.fast)}
                      style={styles.addRow}
                    >
                      <View style={styles.grow}>
                        <TimeField
                          mode="time"
                          value={draftTime}
                          onChange={setDraftTime}
                          accessibilityLabel={t('selectTimeLabel')}
                          autoFocus
                        />
                      </View>
                      <Button size="sm" label={t('addTimeConfirm')} onPress={commitDraft} disabled={!isClockTime(draftTime)} />
                      <AnimatedPressable
                        accessibilityRole="button"
                        accessibilityLabel={t('cancel')}
                        onPress={() => setAddingTime(false)}
                        style={[styles.iconButton, { backgroundColor: c.surfaceRaised, borderColor: c.separator }]}
                      >
                        <Ionicons name="close" size={18} color={c.textSecondary} />
                      </AnimatedPressable>
                    </Animated.View>
                  ) : null}
                </Field>
              </View>
            </Card>
          </Animated.View>

          {/* Supply */}
          <Animated.View entering={enter(2)} layout={expand}>
            <SectionHeader title={t('medicationSupplySectionTitle')} />
            <Card>
              <View style={styles.cardBody}>
                <Field label={t('medicationSupplyOptional')} hint={supplyHint}>
                  <Input
                    value={values.supply}
                    onChangeText={(next) => set('supply', next.replace(/[^\d]/g, ''))}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    placeholder={t('medicationSupplyPlaceholder')}
                  />
                  <View style={styles.chips}>
                    {SUPPLY_PRESETS.map((count) => (
                      <Chip key={count} label={count} selected={values.supply === count} onPress={() => set('supply', count)} />
                    ))}
                  </View>
                </Field>

                {mode === 'edit' ? (
                  <Field label={t('supplyLastRefilled')} error={shown('lastRefilled')}>
                    <TimeField
                      mode="date"
                      value={values.lastRefilled}
                      onChange={(next) => {
                        set('lastRefilled', next);
                        touch('lastRefilled');
                      }}
                      accessibilityLabel={t('selectDateLabel')}
                      invalid={Boolean(shown('lastRefilled'))}
                    />
                  </Field>
                ) : null}
              </View>
            </Card>
          </Animated.View>

          {/* Status (edit only) */}
          {mode === 'edit' ? (
            <Animated.View entering={enter(3)} layout={expand}>
              <SectionHeader title={t('statusLabel')} />
              <Card>
                <View style={styles.cardBody}>
                  <SegmentedControl
                    value={values.status}
                    onChange={(next) => set('status', next as MedicationStatus)}
                    options={[
                      { value: 'active', label: t('statusActive') },
                      { value: 'on-hold', label: t('statusPaused') },
                      { value: 'stopped', label: t('statusArchived') },
                    ]}
                  />
                </View>
              </Card>
            </Animated.View>
          ) : null}
        </Stack>
      </PageShell>

      {Platform.OS === 'web' ? (
        saveBar
      ) : (
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>{saveBar}</KeyboardStickyView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { marginBottom: spacing(4) },
  cardBody: { padding: spacing(4), gap: spacing(4) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.full,
    borderWidth: 1,
  },
  expander: { marginTop: spacing(1) },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
  grow: { flex: 1, minWidth: 0 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
  },
  barInner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    gap: spacing(2),
  },
});
