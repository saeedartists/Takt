import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Badge } from './badge';
import { Card } from './card';
import { motion, radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_SIZE = 56;
const RING_STROKE = 6;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

/** 56px completion ring; the dash offset springs to the new value. */
const ProgressRing = ({ pct }: { pct: number }) => {
  const { c } = useTokens();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(Math.max(0, Math.min(100, pct)) / 100, motion.spring.gentle);
  }, [pct, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - progress.value),
  }));

  return (
    <View style={styles.ring} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          stroke={c.surfaceRaised}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          stroke={pct >= 100 ? c.success : c.accent}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_C} ${RING_C}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <Text style={[typography.caption, styles.ringLabel, { color: c.textSecondary }]}>{`${Math.round(pct)}%`}</Text>
    </View>
  );
};

type GreetingHeroCardProps = {
  patientName?: string;
  takenCount: number;
  totalCount: number;
  dueNowCount: number;
  upcomingCount: number;
  completionPct: number;
  labels: {
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    takenToday: string;
    dueNow: string;
    toCome: string;
  };
};

/** Compact stats strip: greeting, taken/total metric, due/upcoming badges, progress ring. */
export function GreetingHeroCard({
  patientName,
  takenCount,
  totalCount,
  dueNowCount,
  upcomingCount,
  completionPct,
  labels,
}: GreetingHeroCardProps) {
  const { c } = useTokens();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? labels.greetingMorning : hour < 18 ? labels.greetingAfternoon : labels.greetingEvening;
  const greetingText = patientName ? `${greeting}, ${patientName}` : greeting;

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text numberOfLines={1} style={[typography.subhead, { color: c.textSecondary }]}>
            {greetingText}
          </Text>
          <View style={styles.metricRow}>
            <Text style={[typography.metricSm, { color: c.textPrimary, fontVariant: ['tabular-nums'] }]}>
              {`${takenCount}/${totalCount}`}
            </Text>
            <Text style={[typography.footnote, { color: c.textSecondary }]}>{labels.takenToday}</Text>
          </View>
          {totalCount > 0 ? (
            <View style={styles.badges}>
              {dueNowCount > 0 ? <Badge label={`${dueNowCount} ${labels.dueNow}`} tone="warning" /> : null}
              {upcomingCount > 0 ? <Badge label={`${upcomingCount} ${labels.toCome}`} tone="neutral" /> : null}
            </View>
          ) : null}
        </View>
        <ProgressRing pct={completionPct} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(3),
    padding: spacing(4),
  },
  textCol: { flex: 1, minWidth: 0, gap: spacing(1.5) },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing(2) },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5) },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  ringLabel: { position: 'absolute', fontWeight: '600', fontVariant: ['tabular-nums'] },
});
