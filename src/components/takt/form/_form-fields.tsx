import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  AnimatedPressable,
  Field,
  INK,
  MIN_TOUCH_TARGET,
  PAPER,
  PillIcon,
  radius,
  type IconName,
  font,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';
import { MEDICATION_UNIT_LABELS } from '@/lib/takt/medication-form';
import type { MedicationUnit } from '@/lib/takt/types';

/* Reusable form building blocks shared by the medication form. */

/** Fill that eases between idle and selected instead of snapping. */
export const useSelectFill = (selected: boolean, idle: string, active: string) => {
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

/** A form choice in the 3-column grid: icon over label, apricot and ink-edged when chosen. */
export const ChoiceTile = ({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: IconName | 'pill';
  selected: boolean;
  onPress: () => void;
}) => {
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
export const FormField = ({
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
export const SectionTitle = ({ title, color }: { title: string; color: string }) => (
  <Text accessibilityRole="header" style={[typography.title3, { color }]}>
    {title}
  </Text>
);

/**
 * Standard units as a chip selector (mg, ml, tablets, tsp, …) — the picker that
 * replaces typing a unit into the strength field. `onTone` when on a pastel tile.
 */
export const UnitChips = ({
  options,
  selected,
  onSelect,
  onTone = false,
}: {
  options: MedicationUnit[];
  selected: MedicationUnit | '';
  onSelect: (next: MedicationUnit) => void;
  onTone?: boolean;
}) => {
  const { c } = useTokens();
  const { t } = useLocale();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('unitLabel')} style={styles.unitGroup}>
      <Text style={[typography.footnote, { color: onTone ? INK : c.textSecondary, opacity: onTone ? 0.78 : 1 }]}>
        {t('unitLabel')}
      </Text>
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip
            key={option}
            onTone={onTone}
            label={t(MEDICATION_UNIT_LABELS[option])}
            selected={selected === option}
            onPress={() => onSelect(option)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(4),
    borderRadius: radius.full,
  },
  choice: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 68,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1),
    paddingHorizontal: spacing(1),
  },
  choiceCheck: { position: 'absolute', top: spacing(2), right: spacing(2) },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  unitGroup: { gap: spacing(1.5) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), alignItems: 'center' },
});
