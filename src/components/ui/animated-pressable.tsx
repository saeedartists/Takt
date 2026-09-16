import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  activeOpacity?: number;
  hapticFeedback?: boolean;
};

export function AnimatedPressable({
  children,
  style,
  scaleTo = 0.97,
  activeOpacity = 0.88,
  disabled,
  onPress,
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
    scale.value = withSpring(scaleTo, { damping: 18, stiffness: 350 });
    opacity.value = withTiming(activeOpacity, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 350 });
    opacity.value = withTiming(1, { duration: 150 });
  };

  return (
    <AnimatedPressableBase
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      style={[animatedStyle, style]}
      {...props}
    >
      {children}
    </AnimatedPressableBase>
  );
}
