import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius as radiusTokens, spacing } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import { Card } from './card';

/*
 * Skeleton — first-load placeholder. A slow opacity breath, nothing
 * more; Reanimated disables the loop under reduce-motion, leaving a
 * static block. Use the composed SkeletonRow / SkeletonCard so every
 * screen's loading state is built from the same two shapes.
 */
export const Skeleton = ({
  width = '100%',
  height = 16,
  radius = radiusTokens.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) => {
  const { c } = useTokens();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.85, { duration: 700 }), -1, true);
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: c.surfaceRaised }, animated, style]}
    />
  );
};

/** Leading circle plus two lines — a list row while it loads. */
export const SkeletonRow = ({ isFirst = false }: { isFirst?: boolean }) => {
  const { c } = useTokens();
  return (
    <View
      style={[
        styles.row,
        !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
      ]}
    >
      <Skeleton width={36} height={36} radius={radiusTokens.full} />
      <View style={styles.lines}>
        <Skeleton width="62%" height={14} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
};

/** A card with a title line and a large metric — hero / summary blocks. */
export const SkeletonCard = ({ rows = 2 }: { rows?: number }) => (
  <Card>
    <View style={styles.card}>
      <Skeleton width="45%" height={16} />
      <Skeleton width="30%" height={36} radius={radiusTokens.md} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width={i % 2 === 0 ? '85%' : '65%'} height={12} />
      ))}
    </View>
  </Card>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
  },
  lines: { flex: 1, gap: spacing(2) },
  card: { padding: spacing(4), gap: spacing(3) },
});
