import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedPressable,
  Button,
  Card,
  CONTENT_MAX_WIDTH,
  Field,
  INK,
  IconButton,
  Input,
  MIN_TOUCH_TARGET,
  PAPER,
  PageHeader,
  PageShell,
  PillIcon,
  Stack,
  Tile,
  type IconName,
  motion,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
  font,
} from '@/components/ui';
import { MedicationGlyph } from '@/components/takt/medication-glyph';
import { TimeField } from '@/components/takt/time-field';
import { WeekdayPicker } from '@/components/takt/weekday-picker';
import { useLocale } from '@/lib/takt/l10n';
import {
  COLOR_OPTIONS,
  FORM_PRESETS,
  INSTRUCTION_LABEL_KEY,
  INSTRUCTION_OPTIONS,
  SHAPE_LABEL_KEY,
  INTERVAL_PRESETS,
  SHAPE_OPTIONS,
  SUPPLY_PRESETS,
  TIME_PRESETS,
  formatDayLabel,
  isClockTime,
  validateMedicationForm,
  type MedicationFormErrors,
  type MedicationFormValues,
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

/** A chosen time pops in gently from 80%: settle spring, no overshoot. */
const timeIn = ZoomIn.duration(motion.duration.base);

// ponytail: on web, Reanimated leaves a chip stuck at position:absolute when layout + entering overlap; reflow is native-only.
const chipLayout = Platform.OS === 'web' ? undefined : expand;

/** Fill that eases between idle and selected instead of snapping. */
const useSelectFill = (selected: boolean, idle: string, active: string) => {
  const { duration } = useMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: duration.base });
  }, [duration.base, progress, selected]);
  const style = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progress.value, [0, 1], [idle, active]) }));
  // AnimatedPressable is an Animated component, so an animated style is fine in its style array.
  return style as unknown as ViewStyle;
};

/**
 * Selectable pill used for cadence, instruction, supply and refill amounts.
 * Selected = ink. `onTone` when it sits on a pastel tile (tiles stay light in dark mode).
 */
export const Chip = ({
  label,
  selected = false,
  onPress,
  accessibilityLabel,
  trailing,
  onTone = false,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  trailing?: ReactNode;
  onTone?: boolean;
}) => {
  const { c } = useTokens();
  const idle = onTone ? 'rgba(255,255,255,0.75)' : c.surfaceRaised;
  const active = onTone ? INK : c.ink;
  const fill = useSelectFill(selected, idle, active);
  const fg = selected ? (onTone ? PAPER : c.onInk) : onTone ? INK : c.textPrimary;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, fill]}
    >
      {selected ? <Ionicons name="checkmark" size={16} color={fg} /> : null}
      <Text style={[typography.callout, { color: fg, fontFamily: selected ? font.bold : font.semibold, fontVariant: ['tabular-nums'] }]}>
        {label}
      </Text>
      {trailing}
    </AnimatedPressable>
  );
};

const FORM_ICON: Record<(typeof FORM_PRESETS)[number] | 'Other', IconName | 'pill'> = {
  Tablet: 'ellipse-outline',
  Capsule: 'pill',
  Drops: 'water-outline',
  Inhaler: 'fitness-outline',
  Syrup: 'beaker-outline',
  Other: 'ellipsis-horizontal',
};

/** A form choice in the 3-column grid: icon over label, apricot and ink-edged when chosen. */
const ChoiceTile = ({ label, icon, selected, onPress }: { label: string; icon: IconName | 'pill'; selected: boolean; onPress: () => void }) => {
  const { c } = useTokens();
  const fill = useSelectFill(selected, c.background, c.accentSoft);
  const fg = selected ? INK : c.textPrimary;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      scaleTo={0.95}
      style={[styles.choice, { borderColor: selected ? INK : 'transparent' }, fill]}
    >
      {selected ? (
        <View style={styles.choiceCheck}>
          <Ionicons name="checkmark-circle" size={20} color={INK} />
        </View>
      ) : null}
      {icon === 'pill' ? <PillIcon size={26} color={fg} /> : <Ionicons name={icon} size={24} color={fg} />}
      <Text numberOfLines={1} style={[typography.subhead, { color: fg, fontFamily: selected ? font.bold : font.semibold }]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
};

/** Field for the form's cards and tiles: on a pastel tile the text stays ink. */
const FormField = ({
  label,
  hint,
  error,
  onTone = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  onTone?: boolean;
  children: ReactNode;
}) => {
  const { c } = useTokens();
  if (!onTone) return <Field label={label} hint={hint} error={error}>{children}</Field>;
  return (
    <View style={{ gap: spacing(2) }}>
      <Text style={[typography.subhead, { color: INK, fontFamily: font.bold }]}>{label}</Text>
      {children}
      {error ? (
        <View accessibilityRole="alert" style={styles.errorRow}>
          <Ionicons name="alert-circle" size={16} color={c.tones.rose.fg} />
          <Text style={[typography.subhead, { color: c.tones.rose.fg, fontFamily: font.semibold, flex: 1 }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={[typography.footnote, { color: INK, opacity: 0.78 }]}>{hint}</Text>
      ) : null}
    </View>
  );
};

/** Card title inside a section: display face, optional icon. */
const SectionTitle = ({ title, color }: { title: string; color: string }) => (
  <Text accessibilityRole="header" style={[typography.title3, { color }]}>
    {title}
  </Text>
);

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
  // Chips animate only when the user adds or removes one, not on first paint (the section already rises in).
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
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
    setTouched({ name: true, times: true, days: true, lastRefilled: true, interval: true, endDate: true, maxPerDay: true });
    if (!isValid || submitting) return;
    await onSubmit({ ...values, name: values.name.trim(), form: values.form.trim(), times: sortTimes(values.times) });
  };

  const asNeeded = values.cadence === 'as-needed';

  const cadenceOptions: { value: MedicationCadence; label: string }[] = [
    { value: 'daily', label: t('cadenceDaily') },
    { value: 'weekdays', label: t('cadenceWeekdays') },
    { value: 'custom', label: t('cadenceSpecificDays') },
    { value: 'interval', label: t('cadenceEveryDays').replace('{days}', values.intervalDays || '2') },
    { value: 'as-needed', label: t('cadenceAsNeeded') },
  ];

  const stepSupply = (delta: number) => {
    const next = Math.max(0, (Number.parseInt(values.supply, 10) || 0) + delta);
    set('supply', String(next));
  };

  const saveBar = (
    <View
      style={[
        styles.bar,
        { backgroundColor: c.background, borderTopColor: c.separator, paddingBottom: spacing(3) + insets.bottom },
      ]}
    >
      <View style={styles.barInner}>
        {submitError ? (
          <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>
            {submitError}
          </Text>
        ) : null}
        <Button
          size="lg"
          label={mode === 'create' ? t('save') : t('saveChanges')}
          icon={<Ionicons name="checkmark" size={22} color={c.onInk} />}
          onPress={() => void submit()}
          disabled={!isValid}
          loading={submitting}
          haptic="success"
        />
      </View>
    </View>
  );

  const sky = c.tones.sky;
  const butter = c.tones.butter;

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <PageShell>
        <PageHeader subtitle={mode === 'create' ? t('medicationSetupSubtitle') : undefined} />
        <Stack>
          {/* What: name, form, strength, and what the tablet looks like */}
          <Animated.View entering={enter(0)} layout={expand}>
            <Card style={styles.section}>
              <SectionTitle title={t('medicationIdentitySectionTitle')} color={c.textPrimary} />
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
                <View style={styles.grid}>
                  {FORM_PRESETS.map((preset) => (
                    <ChoiceTile
                      key={preset}
                      label={t(FORM_LABEL_KEY[preset])}
                      icon={FORM_ICON[preset]}
                      selected={!otherForm && values.form.toLowerCase() === preset.toLowerCase()}
                      onPress={() => {
                        setOtherForm(false);
                        set('form', preset);
                      }}
                    />
                  ))}
                  <ChoiceTile
                    label={t('formOther')}
                    icon={FORM_ICON.Other}
                    selected={otherForm}
                    onPress={() => {
                      setOtherForm(true);
                      if (isPreset(values.form)) set('form', '');
                    }}
                  />
                </View>
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

              <View style={[styles.divider, { backgroundColor: c.separator }]} />

              <View style={styles.previewRow}>
                <MedicationGlyph appearance={{ shape: values.shape, color: values.color }} size={64} />
                <View style={styles.grow}>
                  <Text style={[typography.subhead, { color: c.textPrimary, fontFamily: font.semibold }]}>{t('appearance')}</Text>
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('appearanceHint')}</Text>
                </View>
              </View>
              <View style={styles.chips}>
                {SHAPE_OPTIONS.map((shape) => {
                  const selected = values.shape === shape;
                  return (
                    <AnimatedPressable
                      key={shape}
                      accessibilityRole="button"
                      accessibilityLabel={t(SHAPE_LABEL_KEY[shape])}
                      accessibilityState={{ selected }}
                      onPress={() => set('shape', shape)}
                      style={[styles.shape, { borderColor: selected ? c.textPrimary : c.separator, borderWidth: selected ? 2 : 1.5 }]}
                    >
                      <MedicationGlyph appearance={{ shape, color: values.color }} size={32} />
                      <Text style={[typography.subhead, { color: c.textPrimary, fontFamily: selected ? font.bold : font.medium }]}>
                        {t(SHAPE_LABEL_KEY[shape])}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {COLOR_OPTIONS.map((color) => {
                  const selected = values.color === color;
                  return (
                    <AnimatedPressable
                      key={color}
                      accessibilityRole="radio"
                      accessibilityLabel={color}
                      accessibilityState={{ selected }}
                      scaleTo={0.9}
                      onPress={() => set('color', color)}
                      style={[styles.swatchRing, { borderColor: selected ? c.textPrimary : 'transparent' }]}
                    >
                      <View style={[styles.swatch, { backgroundColor: color, borderColor: c.separator }]}>
                        {selected ? <Ionicons name="checkmark" size={18} color={isPaleSwatch(color) ? INK : '#FFFFFF'} /> : null}
                      </View>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </Card>
          </Animated.View>

          {/* When (sky): cadence, days, times, end date, how to take it */}
          <Animated.View entering={enter(1)} layout={expand}>
            <Tile tone="sky" style={styles.section}>
              <SectionTitle title={t('medicationScheduleSectionTitle')} color={INK} />
              <FormField onTone label={t('medicationCadence')} error={shown('days') ?? shown('interval')}>
                <View style={styles.chips}>
                  {cadenceOptions.map((option) => (
                    <Chip
                      key={option.value}
                      onTone
                      label={option.label}
                      selected={values.cadence === option.value}
                      onPress={() => set('cadence', option.value)}
                    />
                  ))}
                </View>

                {values.cadence === 'custom' ? (
                  <Animated.View entering={FadeIn.duration(duration.base)} exiting={FadeOut.duration(duration.fast)} style={styles.expander}>
                    <WeekdayPicker
                      days={WEEKDAY_ORDER}
                      selected={values.days}
                      onToggle={toggleDay}
                      labelFor={(day) => formatDayLabel(day, t)}
                    />
                  </Animated.View>
                ) : null}

                {values.cadence === 'interval' ? (
                  <Animated.View entering={FadeIn.duration(duration.base)} exiting={FadeOut.duration(duration.fast)} style={[styles.expander, { gap: spacing(3) }]}>
                    <Text style={[typography.subhead, { color: sky.fg, fontFamily: font.semibold }]}>{t('intervalDaysLabel')}</Text>
                    <View style={styles.chips}>
                      {INTERVAL_PRESETS.map((days) => (
                        <Chip
                          key={days}
                          onTone
                          label={t('cadenceEveryDays').replace('{days}', days)}
                          selected={values.intervalDays === days}
                          onPress={() => {
                            set('intervalDays', days);
                            touch('interval');
                          }}
                        />
                      ))}
                      <View style={styles.smallInput}>
                        <Input
                          value={INTERVAL_PRESETS.includes(values.intervalDays) ? '' : values.intervalDays}
                          onChangeText={(next) => {
                            set('intervalDays', next.replace(/[^\d]/g, ''));
                            touch('interval');
                          }}
                          keyboardType="number-pad"
                          inputMode="numeric"
                          placeholder={t('refillCustomPlaceholder')}
                          accessibilityLabel={t('intervalDaysLabel')}
                          style={styles.smallInputField}
                        />
                      </View>
                    </View>
                    <Text style={[typography.subhead, { color: sky.fg, fontFamily: font.semibold }]}>{t('intervalStartLabel')}</Text>
                    <TimeField
                      mode="date"
                      value={values.intervalStart}
                      onChange={(next) => {
                        set('intervalStart', next);
                        touch('interval');
                      }}
                      accessibilityLabel={t('intervalStartLabel')}
                    />
                  </Animated.View>
                ) : null}
              </FormField>

              {asNeeded ? (
                <Animated.View entering={FadeIn.duration(duration.base)} exiting={FadeOut.duration(duration.fast)} style={{ gap: spacing(4) }}>
                  <Text style={[typography.subhead, { color: sky.fg }]}>{t('asNeededHint')}</Text>
                  <FormField onTone label={t('maxPerDayLabel')} error={shown('maxPerDay')}>
                    <Input
                      value={values.maxPerDay}
                      onChangeText={(next) => {
                        set('maxPerDay', next.replace(/[^\d]/g, ''));
                        touch('maxPerDay');
                      }}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      placeholder="3"
                      invalid={Boolean(shown('maxPerDay'))}
                    />
                  </FormField>
                </Animated.View>
              ) : (
                <FormField onTone label={t('medicationTimes')} hint={t('medicationTimesHint')} error={shown('times')}>
                  <View style={styles.chips}>
                    {values.times.map((time) => (
                      <Animated.View key={`on-${time}`} entering={mounted.current ? timeIn : undefined} exiting={FadeOut.duration(duration.fast)} layout={chipLayout}>
                        <AnimatedPressable
                          accessibilityRole="button"
                          accessibilityLabel={t('removeTimeLabel').replace('{time}', time)}
                          onPress={() => removeTime(time)}
                          style={styles.timeChip}
                        >
                          <Text style={[typography.title3, styles.timeText]}>{time}</Text>
                          <Ionicons name="close-circle" size={22} color={sky.fg} />
                        </AnimatedPressable>
                      </Animated.View>
                    ))}
                    {TIME_PRESETS.filter((preset) => !values.times.includes(preset)).map((time) => (
                      <Animated.View key={`off-${time}`} entering={mounted.current ? FadeIn.duration(duration.base) : undefined} exiting={FadeOut.duration(duration.fast)} layout={chipLayout}>
                        <AnimatedPressable
                          accessibilityRole="button"
                          accessibilityLabel={time}
                          onPress={() => addTime(time)}
                          style={styles.timeSuggestion}
                        >
                          <Ionicons name="add" size={18} color={INK} />
                          <Text style={[typography.callout, { color: INK, fontFamily: font.semibold, fontVariant: ['tabular-nums'] }]}>{time}</Text>
                        </AnimatedPressable>
                      </Animated.View>
                    ))}
                    {!addingTime ? (
                      <Animated.View layout={chipLayout}>
                        <AnimatedPressable
                          accessibilityRole="button"
                          accessibilityLabel={t('addTimeCta')}
                          onPress={() => {
                            setDraftTime(TIME_PRESETS.find((preset) => !values.times.includes(preset)) ?? '08:00');
                            setAddingTime(true);
                          }}
                          style={styles.addTime}
                        >
                          <Text style={[typography.callout, { color: INK, fontFamily: font.bold }]}>{t('addTimeCta')}</Text>
                        </AnimatedPressable>
                      </Animated.View>
                    ) : null}
                  </View>
                  {addingTime ? (
                    <Animated.View entering={FadeIn.duration(duration.fast)} exiting={FadeOut.duration(duration.fast)} style={styles.addRow}>
                      <View style={styles.grow}>
                        <TimeField mode="time" value={draftTime} onChange={setDraftTime} accessibilityLabel={t('selectTimeLabel')} autoFocus />
                      </View>
                      <Button onTone size="sm" fullWidth={false} label={t('addTimeConfirm')} onPress={commitDraft} disabled={!isClockTime(draftTime)} />
                      <IconButton icon="close" accessibilityLabel={t('cancel')} onPress={() => setAddingTime(false)} />
                    </Animated.View>
                  ) : null}
                </FormField>
              )}

              <FormField onTone label={t('endDateLabel')} hint={t('endDateHint')} error={shown('endDate')}>
                <TimeField
                  mode="date"
                  value={values.endDate}
                  onChange={(next) => {
                    set('endDate', next);
                    touch('endDate');
                  }}
                  accessibilityLabel={t('endDateLabel')}
                  invalid={Boolean(shown('endDate'))}
                />
              </FormField>

              <View style={[styles.divider, { backgroundColor: 'rgba(21,23,28,0.12)' }]} />

              <FormField onTone label={t('instructionLabel')}>
                <View style={styles.chips}>
                  {INSTRUCTION_OPTIONS.map((option) => (
                    <Chip
                      key={option}
                      onTone
                      label={t(INSTRUCTION_LABEL_KEY[option])}
                      selected={values.instruction === option}
                      onPress={() => set('instruction', values.instruction === option ? '' : option)}
                    />
                  ))}
                </View>
              </FormField>
              <FormField onTone label={t('instructionNoteLabel')}>
                <Input
                  value={values.instructionNote}
                  onChangeText={(next) => set('instructionNote', next)}
                  placeholder={t('instructionNotePlaceholder')}
                />
              </FormField>
            </Tile>
          </Animated.View>

          {/* Supply (butter): a stepper, with quick pack sizes */}
          <Animated.View entering={enter(2)} layout={expand}>
            <Tile tone="butter" style={styles.section}>
              <SectionTitle title={t('medicationSupplySectionTitle')} color={INK} />
              <FormField onTone label={t('medicationSupplyOptional')} hint={supplyHint}>
                <View style={styles.stepper}>
                  <IconButton icon="remove" accessibilityLabel={t('supplyDecrease')} onPress={() => stepSupply(-1)} size={52} />
                  <Input
                    value={values.supply}
                    onChangeText={(next) => set('supply', next.replace(/[^\d]/g, ''))}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    placeholder={t('medicationSupplyPlaceholder')}
                    accessibilityLabel={t('medicationSupply')}
                    style={styles.stepperInput}
                  />
                  <IconButton icon="add" kind="ink" accessibilityLabel={t('supplyIncrease')} onPress={() => stepSupply(1)} size={52} />
                </View>
                <View style={styles.chips}>
                  {SUPPLY_PRESETS.map((count) => (
                    <Chip key={count} onTone label={count} selected={values.supply === count} onPress={() => set('supply', count)} />
                  ))}
                </View>
              </FormField>

              {mode === 'edit' ? (
                <FormField onTone label={t('supplyLastRefilled')} error={shown('lastRefilled')}>
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
                </FormField>
              ) : null}
            </Tile>
          </Animated.View>
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

/** Swatches pale enough to need an ink check mark. */
const isPaleSwatch = (hex: string): boolean => {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170;
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { padding: spacing(5), gap: spacing(4.5) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), alignItems: 'center' },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(4),
    borderRadius: radius.full,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  choice: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 80,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(1),
  },
  choiceCheck: { position: 'absolute', top: spacing(2), right: spacing(2) },
  divider: { height: StyleSheet.hairlineWidth },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3.5) },
  shape: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingLeft: spacing(1),
    paddingRight: spacing(3.5),
    borderRadius: radius.full,
  },
  swatchRing: { width: 52, height: 52, borderRadius: radius.full, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expander: { marginTop: spacing(1) },
  timeChip: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingLeft: spacing(4.5),
    paddingRight: spacing(3),
    borderRadius: radius.full,
    backgroundColor: '#FFFFFF',
  },
  timeText: { color: INK, fontVariant: ['tabular-nums'] },
  timeSuggestion: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingLeft: spacing(3),
    paddingRight: spacing(4),
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  addTime: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
    borderRadius: radius.full,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(21,23,28,0.35)',
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  grow: { flex: 1, minWidth: 0 },
  smallInput: { width: 104 },
  smallInputField: { minHeight: MIN_TOUCH_TARGET, paddingVertical: 0 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    padding: spacing(1.5),
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  stepperInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    textAlign: 'center',
    color: INK,
    fontFamily: font.display,
    fontSize: 32,
    lineHeight: 38,
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
  },
  barInner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    gap: spacing(2),
  },
});
