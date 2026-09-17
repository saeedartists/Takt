import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { motion, spacing, typography } from '@/theme/tokens';
import { useTokens } from '@/theme/use-tokens';
import { Card } from './card';

type CelebrationCardProps = {
  title?: string;
  subtitle?: string;
  count: number;
  /** Localized "logged" for the "(4/4 logged)" suffix. */
  loggedLabel?: string;
};

export function CelebrationCard({
  title = 'All caught up for today',
  subtitle = 'You have taken all scheduled medications.',
  count,
  loggedLabel = 'logged',
}: CelebrationCardProps) {
  const { c } = useTokens();

  return (
    <Card>
      <View style={styles.content}>
        {/* One-shot spring-in; the soft ring is static (Calm UX B.13). */}
        <Animated.View
          entering={ZoomIn.springify()
            .damping(motion.spring.snappy.damping)
            .stiffness(motion.spring.snappy.stiffness)}
          style={styles.iconWrapper}
        >
          <View style={[styles.softRing, { backgroundColor: `${c.success}20` }]} />
          <View style={[styles.iconCircle, { backgroundColor: `${c.success}1A` }]}>
            <Ionicons name="checkmark-done-circle" size={32} color={c.success} />
          </View>
        </Animated.View>

        <View style={styles.textColumn}>
          <Text style={[typography.headline, { color: c.textPrimary }]}>{title}</Text>
          <Text style={[typography.footnote, { color: c.textSecondary, marginTop: 2 }]}>
            {subtitle}
            {count > 0 ? ` (${count}/${count} ${loggedLabel})` : ''}
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
  softRing: {
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
