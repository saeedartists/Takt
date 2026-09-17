import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '../../theme/tokens';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export type HapticKind = 'light' | 'medium' | 'rigid' | 'success' | 'warning' | 'error';

/** Fire a haptic on native; a silent no-op on web and on devices without an engine. */
export const triggerHaptic = (kind: HapticKind): void => {
  if (Platform.OS === 'web') return;
  const run =
    kind === 'success'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : kind === 'warning'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        : kind === 'error'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          : kind === 'rigid'
            ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)
            : kind === 'medium'
              ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  run.catch(() => undefined);
};

type AnimatedPressableProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  activeOpacity?: number;
  /** Haptic fired on press. Omit for silent controls (chips, rows). */
  haptic?: HapticKind | false;
  /** @deprecated use `haptic="light"`. Kept so existing call sites still work. */
  hapticFeedback?: boolean;
};

export function AnimatedPressable({
  children,
  style,
  scaleTo = 0.97,
  activeOpacity = 0.88,
  disabled,
  onPress,
  haptic,
  hapticFeedback,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(scaleTo, motion.spring.snappy);
    opacity.value = withTiming(activeOpacity, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, motion.spring.snappy);
    opacity.value = withTiming(1, { duration: motion.duration.fast });
  };

  const handlePress = (event: GestureResponderEvent) => {
    const kind = haptic ?? (hapticFeedback ? 'light' : undefined);
    if (kind) triggerHaptic(kind);
    onPress?.(event);
  };

  return (
    <AnimatedPressableBase
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      style={[animatedStyle, style]}
      {...props}
    >
      {children}
    </AnimatedPressableBase>
  );
}
