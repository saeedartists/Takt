import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MIN_TOUCH_TARGET, font, radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import { AnimatedPressable, type HapticKind } from './animated-pressable';
import { AnimatedSegmentedControl } from './animated-segmented-control';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  /** Quiet helper text under the control. */
  hint?: string;
  /** Inline validation message; replaces the hint when present. */
  error?: string | null;
  children: ReactNode;
}) => {
  const { c } = useTokens();
  return (
    <View style={{ gap: spacing(2) }}>
      <Text style={[typography.subhead, { color: c.textPrimary, fontFamily: font.semibold }]}>{label}</Text>
      {children}
      {error ? (
        <View accessibilityRole="alert" style={styles.errorRow}>
          <Ionicons name="alert-circle" size={16} color={c.destructive} />
          <Text style={[typography.subhead, { color: c.destructive, flex: 1 }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={[typography.footnote, { color: c.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  );
};

// Browsers draw their own blue focus ring; we draw ours with the ink border.
const webInputReset = Platform.OS === 'web' ? ({ outlineWidth: 0 } as const) : null;

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export const Input = ({
  style,
  onFocus,
  onBlur,
  invalid = false,
  ...props
}: TextInputProps & { invalid?: boolean }) => {
  const { c } = useTokens();
  const focus = useSharedValue(0);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, { duration: 160 });
  }, [focus, focused]);

  // The border darkens to ink on focus: a calm, obvious "you are here".
  const idle = invalid ? c.destructive : c.separator;
  const active = invalid ? c.destructive : c.textPrimary;
  const animated = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [idle, active]),
  }));

  return (
    <AnimatedTextInput
      placeholderTextColor={c.textTertiary}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        typography.body,
        { color: c.textPrimary, backgroundColor: c.surface, borderWidth: focused || invalid ? 2 : 1.5 },
        animated,
        webInputReset,
        style,
      ]}
      {...props}
    />
  );
};

export const SegmentedControl = AnimatedSegmentedControl;

export type ButtonKind = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';

/*
 * Button — pill shaped, always ≥ 48 tall.
 *   primary      ink pill; pass `accentIcon` for the brand "action dot"
 *   secondary    quiet filled pill
 *   outline      hairline pill for the third option (Skip)
 *   ghost        text-only, for links and low-weight actions
 *   destructive  rose-tinted, for remove / sign-out-like actions
 */
export const Button = ({
  label,
  onPress,
  kind = 'primary',
  size = 'md',
  disabled,
  loading = false,
  icon,
  accentIcon,
  haptic,
  accessibilityLabel,
  style,
  fullWidth = true,
}: {
  label: string;
  onPress?: () => void;
  kind?: ButtonKind;
  size?: 'lg' | 'md' | 'sm';
  disabled?: boolean;
  /** Shows a spinner in place of the label and blocks presses. Width is preserved. */
  loading?: boolean;
  /** Leading glyph, e.g. an Ionicons element. */
  icon?: ReactNode;
  /** Primary only: an icon in a tinted circle at the trailing edge. */
  accentIcon?: IconName;
  haptic?: HapticKind | false;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}) => {
  const { c } = useTokens();
  const isDisabled = Boolean(disabled) || loading;
  const height = size === 'lg' ? 64 : size === 'md' ? 56 : MIN_TOUCH_TARGET;

  const palette: Record<ButtonKind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.ink, fg: c.onInk },
    secondary: { bg: c.surfaceRaised, fg: c.textPrimary },
    outline: { bg: 'transparent', fg: c.textPrimary, border: c.separator },
    ghost: { bg: 'transparent', fg: c.textPrimary },
    destructive: { bg: c.tones.rose.bg, fg: c.tones.rose.fg },
  };
  const tone = palette[kind];
  const withDot = kind === 'primary' && Boolean(accentIcon);
  const textStyle = size === 'sm' ? typography.subhead : typography.headline;

  return (
    <AnimatedPressable
      disabled={isDisabled}
      haptic={haptic ?? (kind === 'destructive' ? 'rigid' : 'light')}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      style={[
        styles.button,
        {
          minHeight: height,
          backgroundColor: tone.bg,
          borderColor: tone.border ?? 'transparent',
          borderWidth: tone.border ? 1.5 : 0,
          opacity: disabled && !loading ? 0.45 : 1,
          paddingLeft: withDot ? spacing(6.5) : spacing(5),
          paddingRight: withDot ? spacing(2) : spacing(5),
          justifyContent: withDot ? 'space-between' : 'center',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      <View style={[styles.buttonInner, { opacity: loading ? 0 : 1 }]}>
        {icon}
        <Text
          numberOfLines={1}
          style={[textStyle, { color: tone.fg, fontFamily: kind === 'ghost' ? font.semibold : font.bold }]}
        >
          {label}
        </Text>
      </View>
      {withDot && accentIcon ? (
        <View style={[styles.dot, { width: height - 16, height: height - 16, backgroundColor: c.accentSoft }]}>
          <Ionicons name={accentIcon} size={22} color={c.onAccentSoft} />
        </View>
      ) : null}
      {loading ? <ActivityIndicator color={tone.fg} style={StyleSheet.absoluteFill} /> : null}
    </AnimatedPressable>
  );
};

/** Round icon-only button (back, bell, add). Always pass an accessibilityLabel. */
export const IconButton = ({
  icon,
  onPress,
  accessibilityLabel,
  kind = 'surface',
  size = MIN_TOUCH_TARGET,
  haptic = 'light',
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  kind?: 'surface' | 'ink' | 'quiet';
  size?: number;
  haptic?: HapticKind | false;
}) => {
  const { c } = useTokens();
  const bg = kind === 'ink' ? c.ink : kind === 'quiet' ? c.surfaceRaised : c.surface;
  const fg = kind === 'ink' ? c.onInk : c.textPrimary;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      haptic={haptic}
      scaleTo={0.9}
      onPress={onPress}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.46)} color={fg} />
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  input: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4.5),
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    flexShrink: 1,
  },
  dot: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing(3),
  },
});
