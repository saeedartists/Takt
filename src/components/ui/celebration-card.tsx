import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTokens } from '@/theme/use-tokens';
import { Card } from './card';

type CelebrationCardProps = {
  title?: string;
  subtitle?: string;
  count: number;
};

export function CelebrationCard({
  title = 'All caught up for today',
  subtitle = 'You have taken all scheduled medications.',
  count,
}: CelebrationCardProps) {
  const { c } = useTokens();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1200 }),
        withTiming(1, { duration: 1200 })
      ),
      -1,
      true
    );
  }, [scale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Card>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Animated.View
            style={[
              styles.pulseGlow,
              { backgroundColor: `${c.success}20` },
              pulseStyle,
            ]}
          />
          <View style={[styles.iconCircle, { backgroundColor: `${c.success}1A` }]}>
            <Ionicons name="checkmark-done-circle" size={32} color={c.success} />
          </View>
        </View>

        <View style={styles.textColumn}>
          <Text style={[typography.headline, { color: c.textPrimary }]}>{title}</Text>
          <Text style={[typography.footnote, { color: c.textSecondary, marginTop: 2 }]}>
            {subtitle} {count > 0 ? `(${count}/${count} logged)` : ''}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing(4),
    gap: spacing(3.5),
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  pulseGlow: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
});
