import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { Badge } from './badge';
import { AnimatedProgressBar } from './animated-progress-bar';
import { radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

type GreetingHeroCardProps = {
  patientName?: string;
  dateLabel: string;
  takenCount: number;
  totalCount: number;
  dueNowCount: number;
  upcomingCount: number;
  completionPct: number;
  labels: {
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    rhythmToday: string;
    takenToday: string;
    completion: string;
    allDoneToday: string;
    dueNow: string;
    toCome: string;
    logged: string;
  };
};

export function GreetingHeroCard({
  patientName,
  dateLabel,
  takenCount,
  totalCount,
  dueNowCount,
  upcomingCount,
  completionPct,
  labels,
}: GreetingHeroCardProps) {
  const { c, scheme } = useTokens();

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (dueNowCount > 0) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1200 }),
          withTiming(1, { duration: 1200 }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 300 });
    }
  }, [dueNowCount, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return labels.greetingMorning;
    if (hour < 18) return labels.greetingAfternoon;
    return labels.greetingEvening;
  };

  const greetingText = patientName ? `${getGreeting()}, ${patientName}` : getGreeting();
  const isAllDone = totalCount > 0 && takenCount === totalCount;

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.cardBorder,
        },
        scheme === 'light' && styles.lightShadow,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={[typography.headline, { color: c.textPrimary }]}>{greetingText}</Text>
          <Text style={[typography.footnote, { color: c.textSecondary, marginTop: 2 }]}>{dateLabel}</Text>
        </View>

        {isAllDone ? (
          <View style={[styles.allDoneBadge, { backgroundColor: `${c.success}18` }]}>
            <Ionicons name="sparkles" size={16} color={c.success} />
            <Text style={[typography.footnote, { color: c.success, fontWeight: '600' }]}>
              {labels.allDoneToday}
            </Text>
          </View>
        ) : dueNowCount > 0 ? (
          <Animated.View style={pulseStyle}>
            <Badge label={`${dueNowCount} ${labels.dueNow}`} tone="warning" />
          </Animated.View>
        ) : (
          <Badge label={`${completionPct}% ${labels.completion}`} tone="accent" />
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.metricGroup}>
          <Text
            style={[
              typography.metric,
              {
                color: c.accent,
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {`${takenCount}/${totalCount}`}
          </Text>
          <Text style={[typography.footnote, { color: c.textSecondary, marginTop: 2 }]}>
            {labels.takenToday}
          </Text>
        </View>

        <View style={styles.chipsWrap}>
          <Badge label={`${dueNowCount} ${labels.dueNow}`} tone={dueNowCount > 0 ? 'warning' : 'neutral'} />
          <Badge label={`${upcomingCount} ${labels.toCome}`} tone="neutral" />
          <Badge label={`${takenCount} ${labels.logged}`} tone="success" />
        </View>
      </View>

      <View style={styles.progressSection}>
        <AnimatedProgressBar progress={completionPct} height={8} color={c.accent} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing(4),
    gap: spacing(3.5),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing(2),
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  allDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radius.full,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing(3),
  },
  metricGroup: {
    flexShrink: 0,
  },
  chipsWrap: {
    flexDirection: 'row',
    gap: spacing(1.5),
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flex: 1,
  },
  progressSection: {
    marginTop: spacing(0.5),
  },
  lightShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
