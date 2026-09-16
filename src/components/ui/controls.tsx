import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { MIN_TOUCH_TARGET, radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

export const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => {
  const { c } = useTokens();
  return (
    <View style={{ gap: spacing(1.5) }}>
      <Text style={[typography.footnote, { color: c.textSecondary, letterSpacing: 0.2 }]}>{label}</Text>
      {children}
    </View>
  );
};

export const Input = (props: TextInputProps) => {
  const { c } = useTokens();
  return (
    <TextInput
      placeholderTextColor={c.textTertiary}
      style={[
        styles.input,
        typography.body,
        {
          color: c.textPrimary,
          borderColor: c.separator,
          backgroundColor: c.surface,
        },
      ]}
      {...props}
    />
  );
};

import { AnimatedPressable } from './animated-pressable';
import { AnimatedSegmentedControl } from './animated-segmented-control';

export const SegmentedControl = AnimatedSegmentedControl;

export const Button = ({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
}) => {
  const { c } = useTokens();
  const backgroundColor =
    kind === 'primary' ? c.accent : kind === 'destructive' ? `${c.destructive}20` : c.surfaceRaised;
  const textColor = kind === 'primary' ? c.surface : kind === 'destructive' ? c.destructive : c.textPrimary;

  return (
    <AnimatedPressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor: c.separator,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text style={[typography.headline, { color: textColor }]}>{label}</Text>
    </AnimatedPressable>
  );
};


const styles = StyleSheet.create({
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: StyleSheet.hairlineWidth,
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
  segmentedWrap: {
    flexDirection: 'row',
    gap: spacing(1),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing(1),
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
