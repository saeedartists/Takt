import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { radius, spacing } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

type AnimatedProgressBarProps = {
  progress: number; // 0 to 100 (or 0 to 1)
  height?: number;
  color?: string;
  tintColor?: string;
  backgroundColor?: string;
  style?: ViewStyle;
};

export function AnimatedProgressBar({
  progress,
  height = 10,
  color,
  tintColor,
  backgroundColor,
  style,
}: AnimatedProgressBarProps) {
  const { c } = useTokens();
  const trackColor = backgroundColor ?? c.surfaceRaised;
  const barColor = color ?? tintColor ?? c.accent;

  const normalized = progress <= 1 && progress > 0 ? progress * 100 : progress;
  const clamped = Math.max(0, Math.min(100, normalized));
  const animatedWidth = useSharedValue(clamped);

  useEffect(() => {
    const norm = progress <= 1 && progress > 0 ? progress * 100 : progress;
    const clamp = Math.max(0, Math.min(100, norm));
    animatedWidth.value = withSpring(clamp, {
      damping: 22,
      stiffness: 140,
      mass: 0.8,
    });
  }, [progress, animatedWidth]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        {
          height,
          backgroundColor: trackColor,
          borderColor: c.separator,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: barColor,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: radius.full,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
});
