import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import { AnimatedPressable, type HapticKind } from './animated-pressable';
import { AnimatedSegmentedControl } from './animated-segmented-control';

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
    <View style={{ gap: spacing(1.5) }}>
      <Text style={[typography.footnote, { color: c.textSecondary, letterSpacing: 0.2 }]}>{label}</Text>
      {children}
      {error ? (
        <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[typography.footnote, { color: c.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  );
};

// Browsers draw their own blue focus ring; we draw ours with the accent border.
const webInputReset = Platform.OS === 'web' ? ({ outlineWidth: 0 } as const) : null;

export const Input = ({
  style,
  onFocus,
  onBlur,
  invalid = false,
  ...props
}: TextInputProps & { invalid?: boolean }) => {
  const { c } = useTokens();
  const [focused, setFocused] = useState(false);
  const borderColor = invalid ? c.destructive : focused ? c.accent : c.separator;

  return (
    <TextInput
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
        { color: c.textPrimary, backgroundColor: c.surface, borderColor },
        webInputReset,
        style,
      ]}
      {...props}
    />
  );
};

export const SegmentedControl = AnimatedSegmentedControl;

export const Button = ({
  label,
  onPress,
  kind = 'primary',
  size = 'md',
  disabled,
  loading = false,
  icon,
  haptic,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'secondary' | 'destructive';
  size?: 'md' | 'sm';
  disabled?: boolean;
  /** Shows a spinner in place of the label and blocks presses. Width is preserved. */
  loading?: boolean;
  /** Leading glyph, e.g. an Ionicons element. */
  icon?: ReactNode;
  haptic?: HapticKind | false;
  accessibilityLabel?: string;
}) => {
  const { c } = useTokens();
  const isDisabled = Boolean(disabled) || loading;
  const backgroundColor =
    kind === 'primary' ? c.accent : kind === 'destructive' ? `${c.destructive}20` : c.surfaceRaised;
  const textColor = kind === 'primary' ? c.surface : kind === 'destructive' ? c.destructive : c.textPrimary;

  return (
    <AnimatedPressable
      disabled={isDisabled}
      haptic={haptic ?? (kind === 'destructive' ? 'rigid' : 'light')}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      style={[
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor, borderColor: c.separator, opacity: disabled && !loading ? 0.45 : 1 },
      ]}
    >
      <View style={[styles.buttonInner, { opacity: loading ? 0 : 1 }]}>
        {icon}
        <Text style={[size === 'sm' ? typography.subhead : typography.headline, { color: textColor, fontWeight: '600' }]}>
          {label}
        </Text>
      </View>
      {loading ? <ActivityIndicator color={textColor} style={StyleSheet.absoluteFill} /> : null}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
  },
  button: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing(4),
  },
  buttonSm: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing(3),
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
  },
});
