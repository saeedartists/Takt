import { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { MIN_TOUCH_TARGET, radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

type SegmentOption = {
  value: string;
  label: string;
};

type AnimatedSegmentedControlProps = {
  value: string;
  options: SegmentOption[];
  onChange: (next: string) => void;
  style?: ViewStyle;
};

export function AnimatedSegmentedControl({
  value,
  options,
  onChange,
  style,
}: AnimatedSegmentedControlProps) {
  const { c, scheme } = useTokens();
  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value),
  );

  const segmentWidth =
    containerWidth > 0 && options.length > 0
      ? (containerWidth - spacing(2)) / options.length
      : 0;

  const translateX = useSharedValue(0);

  useEffect(() => {
    if (segmentWidth > 0) {
      translateX.value = withSpring(activeIndex * segmentWidth, {
        damping: 22,
        stiffness: 240,
        mass: 0.7,
      });
    }
  }, [activeIndex, segmentWidth, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: segmentWidth,
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
      translateX.value = activeIndex * ((width - spacing(2)) / options.length);
    }
  };

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.wrap,
        {
          backgroundColor: c.surfaceRaised,
          borderColor: c.separator,
        },
        style,
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            {
              backgroundColor: c.surface,
              borderColor: c.separator,
            },
            scheme === 'light' && styles.lightShadow,
            indicatorStyle,
          ]}
        />
      ) : null}

      {options.map((option, index) => {
        const active = index === activeIndex;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={styles.segment}
          >
            <Text
              numberOfLines={1}
              style={[
                typography.subhead,
                {
                  color: active ? c.textPrimary : c.textSecondary,
                  fontWeight: active ? '600' : '400',
                },
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
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing(1),
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: spacing(1),
    left: spacing(1),
    bottom: spacing(1),
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET - 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2),
    zIndex: 1,
  },
  lightShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
