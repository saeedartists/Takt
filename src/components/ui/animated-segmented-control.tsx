import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { font, radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import { triggerHaptic } from './animated-pressable';

type SegmentOption = {
  value: string;
  label: string;
};

type AnimatedSegmentedControlProps = {
  value: string;
  options: SegmentOption[];
  onChange: (next: string) => void;
  style?: ViewStyle;
  /** Track colour: `raised` on white cards, `surface` on the paper ground. */
  track?: 'raised' | 'surface';
  /** Thumb colour for a selected value that carries meaning (e.g. Taken = success). */
  thumbColor?: string;
};

// A glide with no overshoot: the ink thumb should land, not wobble.
const GLIDE = { damping: 26, stiffness: 300, mass: 0.8, overshootClamping: true } as const;

export function AnimatedSegmentedControl({
  value,
  options,
  onChange,
  style,
  track = 'raised',
  thumbColor,
}: AnimatedSegmentedControlProps) {
  const { c } = useTokens();
  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value),
  );
  const pad = spacing(1);
  const segmentWidth = containerWidth > 0 && options.length > 0 ? (containerWidth - pad * 2) / options.length : 0;

  const translateX = useSharedValue(0);

  useEffect(() => {
    if (segmentWidth > 0) translateX.value = withSpring(activeIndex * segmentWidth, GLIDE);
  }, [activeIndex, segmentWidth, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: segmentWidth,
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
      translateX.value = activeIndex * ((width - pad * 2) / options.length);
    }
  };

  const thumb = thumbColor ?? c.ink;
  const onThumb = thumbColor ? '#FFFFFF' : c.onInk;

  return (
    <View
      onLayout={handleLayout}
      accessibilityRole="tablist"
      style={[styles.wrap, { backgroundColor: track === 'surface' ? c.surface : c.surfaceRaised }, style]}
    >
      {segmentWidth > 0 ? (
        <Animated.View style={[styles.indicator, { backgroundColor: thumb }, indicatorStyle]} />
      ) : null}

      {options.map((option, index) => {
        const active = index === activeIndex;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!active) triggerHaptic('light');
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.segment}
          >
            <Text
              numberOfLines={1}
              style={[
                typography.callout,
                { color: active ? onThumb : c.textSecondary, fontFamily: active ? font.bold : font.semibold },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    padding: spacing(1),
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: spacing(1),
    left: spacing(1),
    bottom: spacing(1),
    borderRadius: radius.full,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2),
    zIndex: 1,
  },
});
