import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from './badge';
import { AnimatedPressable } from './animated-pressable';
import { Button } from './controls';
import { radius, spacing, typography } from '../../theme/tokens';
import { useMotion } from '../../theme/use-motion';
import { useTokens } from '../../theme/use-tokens';
import type { DoseOccurrence, DoseState } from '../../lib/takt/types';

type Pending = 'take' | 'skip' | 'snooze' | 'undo' | null;

type AnimatedDoseRowProps = {
  dose: DoseOccurrence;
  isFirst?: boolean;
  isFocused?: boolean;
  canUndo: boolean;
  stateLabel: string;
  onTake: () => Promise<void>;
  onSkip: () => Promise<void>;
  onSnooze: (minutes: number) => Promise<void>;
  onUndo: () => Promise<void>;
  busy?: boolean;
  snoozeOptions?: number[];
  defaultSnoozeMinutes: number;
  labels: {
    /** Formatted scheduled time, used in accessibility labels. */
    time: string;
    confirmTaken: string;
    markSkipped: string;
    snooze: string;
    snoozeRemindIn: string;
    cancel: string;
    undo: string;
    contextBadge?: string;
  };
};

const stateTone = (state: DoseState): 'neutral' | 'accent' | 'success' | 'warning' | 'destructive' => {
  if (state === 'taken') return 'success';
  if (state === 'due') return 'warning';
  if (state === 'missed') return 'destructive';
  if (state === 'skipped') return 'warning';
  return 'neutral';
};

export function AnimatedDoseRow({
  dose,
  isFirst = false,
  isFocused = false,
  canUndo,
  stateLabel,
  onTake,
  onSkip,
  onSnooze,
  onUndo,
  busy = false,
  snoozeOptions = [5, 10, 15, 30],
  defaultSnoozeMinutes,
  labels,
}: AnimatedDoseRowProps) {
  const { c } = useTokens();
  const { spring, duration } = useMotion();
  const [pending, setPending] = useState<Pending>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeMinutes, setSnoozeMinutes] = useState(defaultSnoozeMinutes);

  useEffect(() => setSnoozeMinutes(defaultSnoozeMinutes), [defaultSnoozeMinutes]);

  const checkScale = useSharedValue(1);
  // 0 → 1 while taken (success tint), 0 → 1 while skipped (dimmed). Undo reverses both.
  const takenT = useSharedValue(dose.state === 'taken' ? 1 : 0);
  const skippedT = useSharedValue(dose.state === 'skipped' ? 1 : 0);

  useEffect(() => {
    takenT.value = withTiming(dose.state === 'taken' ? 1 : 0, { duration: duration.base });
    skippedT.value = withTiming(dose.state === 'skipped' ? 1 : 0, { duration: duration.base });
  }, [dose.state, duration.base, skippedT, takenT]);

  const run = async (kind: Exclude<Pending, null>, action: () => Promise<void>) => {
    setPending(kind);
    try {
      await action();
    } finally {
      setPending(null);
    }
  };

  const handleTake = () => {
    checkScale.value = withSequence(withSpring(1.2, spring.snappy), withSpring(1, spring.gentle));
    void run('take', onTake);
  };

  const confirmSnooze = async () => {
    await run('snooze', () => onSnooze(snoozeMinutes));
    setSnoozeOpen(false);
  };

  const checkAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const rowAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(takenT.value, [0, 1], [`${c.success}00`, `${c.success}14`]),
    opacity: 1 - skippedT.value * 0.4,
  }));
  const titleAnimStyle = useAnimatedStyle(() => ({ opacity: 1 - takenT.value * 0.35 }));

  const railBg =
    dose.state === 'taken'
      ? c.success
      : dose.state === 'due'
        ? c.warning
        : dose.state === 'missed'
          ? c.destructive
          : dose.state === 'skipped'
            ? c.warning
            : c.separator;

  const locked = busy || pending !== null;
  const who = `${dose.label}, ${labels.time}`;

  return (
    <Animated.View
      layout={LinearTransition}
      style={[
        styles.row,
        isFocused && { backgroundColor: c.surfaceRaised },
        !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
        rowAnimStyle,
      ]}
    >
      <View style={[styles.rail, { backgroundColor: railBg }]} />

      <View style={styles.contentCol}>
        <View style={styles.titleRow}>
          <Animated.View style={[{ flex: 1, minWidth: 0, gap: 2 }, titleAnimStyle]}>
            <Text numberOfLines={1} style={[typography.headline, { color: c.textPrimary }]}>
              {dose.label}
            </Text>
            {dose.strength ? (
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{dose.strength}</Text>
            ) : null}
          </Animated.View>

          <View style={styles.badgesWrap}>
            <Badge label={stateLabel} tone={stateTone(dose.state)} />
            {isFocused && labels.contextBadge ? (
              <Badge label={labels.contextBadge} tone="accent" />
            ) : null}
          </View>
        </View>

        {dose.state === 'due' ? (
          <View style={styles.dueActionsCol}>
            <AnimatedPressable
              onPress={handleTake}
              disabled={locked}
              haptic="success"
              accessibilityRole="button"
              accessibilityLabel={`${labels.confirmTaken}, ${who}`}
              accessibilityState={{ disabled: locked, busy: pending === 'take' }}
              style={[styles.primaryAction, { backgroundColor: c.accent }]}
            >
              <Animated.View style={[styles.actionInner, checkAnimStyle]}>
                {pending === 'take' ? (
                  <ActivityIndicator color={c.surface} />
                ) : (
                  <Ionicons name="checkmark" size={18} color={c.surface} />
                )}
                <Text style={[typography.headline, { color: c.surface, fontWeight: '600' }]}>
                  {labels.confirmTaken}
                </Text>
              </Animated.View>
            </AnimatedPressable>

            <View style={styles.pillActionsRow}>
              <AnimatedPressable
                onPress={() => void run('skip', onSkip)}
                disabled={locked}
                haptic="warning"
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`${labels.markSkipped}, ${who}`}
                accessibilityState={{ disabled: locked, busy: pending === 'skip' }}
                style={[
                  styles.secondaryPill,
                  { backgroundColor: `${c.warning}1A`, borderColor: `${c.warning}44` },
                ]}
              >
                {pending === 'skip' ? (
                  <ActivityIndicator size="small" color={c.warning} />
                ) : (
                  <Ionicons name="close-circle-outline" size={15} color={c.warning} />
                )}
                <Text style={[typography.footnote, { color: c.warning, fontWeight: '600' }]}>
                  {labels.markSkipped}
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => setSnoozeOpen((open) => !open)}
                disabled={locked}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`${labels.snooze}, ${who}`}
                accessibilityState={{ disabled: locked, expanded: snoozeOpen }}
                style={[
                  styles.secondaryPill,
                  { backgroundColor: `${c.accent}1A`, borderColor: snoozeOpen ? c.accent : `${c.accent}44` },
                ]}
              >
                <Ionicons name="alarm-outline" size={15} color={c.accent} />
                <Text style={[typography.footnote, { color: c.accent, fontWeight: '600' }]}>
                  {labels.snooze}
                </Text>
              </AnimatedPressable>
            </View>

            {snoozeOpen ? (
              <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.snoozePanel}>
                <Text style={[typography.footnote, { color: c.textSecondary }]}>{labels.snoozeRemindIn}</Text>
                <View style={styles.pillActionsRow}>
                  {snoozeOptions.map((minutes) => {
                    const selected = minutes === snoozeMinutes;
                    return (
                      <AnimatedPressable
                        key={minutes}
                        onPress={() => setSnoozeMinutes(minutes)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${labels.snooze} ${minutes} min, ${who}`}
                        style={[
                          styles.chip,
                          selected
                            ? { backgroundColor: c.accent, borderColor: c.accent }
                            : { backgroundColor: c.surfaceRaised, borderColor: c.separator },
                        ]}
                      >
                        <Text
                          style={[
                            typography.subhead,
                            { color: selected ? c.surface : c.textPrimary, fontWeight: '600' },
                          ]}
                        >
                          {`${minutes} min`}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
                <View style={styles.pillActionsRow}>
                  <Button
                    size="sm"
                    label={labels.snooze}
                    loading={pending === 'snooze'}
                    disabled={locked}
                    accessibilityLabel={`${labels.snooze} ${snoozeMinutes} min, ${who}`}
                    onPress={() => void confirmSnooze()}
                  />
                  <Button
                    size="sm"
                    kind="secondary"
                    label={labels.cancel}
                    disabled={pending === 'snooze'}
                    accessibilityLabel={`${labels.cancel} ${labels.snooze}, ${who}`}
                    onPress={() => setSnoozeOpen(false)}
                  />
                </View>
              </Animated.View>
            ) : null}
          </View>
        ) : null}

        {canUndo ? (
          <View style={styles.undoRow}>
            <AnimatedPressable
              onPress={() => void run('undo', onUndo)}
              disabled={locked}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`${labels.undo}, ${who}`}
              accessibilityState={{ disabled: locked, busy: pending === 'undo' }}
              style={[
                styles.secondaryPill,
                { backgroundColor: `${c.accent}14`, borderColor: `${c.accent}33` },
              ]}
            >
              {pending === 'undo' ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : (
                <Ionicons name="arrow-undo" size={14} color={c.accent} />
              )}
              <Text style={[typography.footnote, { color: c.accent, fontWeight: '600' }]}>
                {labels.undo}
              </Text>
            </AnimatedPressable>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
    gap: spacing(3),
  },
  rail: {
    width: 4,
    borderRadius: radius.full,
    minHeight: 46,
    alignSelf: 'stretch',
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
    gap: spacing(2.5),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing(2),
  },
  badgesWrap: {
    flexDirection: 'row',
    gap: spacing(1.5),
    alignItems: 'center',
  },
  dueActionsCol: {
    gap: spacing(2),
    marginTop: spacing(1),
  },
  primaryAction: {
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
  },
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  pillActionsRow: {
    flexDirection: 'row',
    gap: spacing(2),
    flexWrap: 'wrap',
  },
  secondaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    minHeight: 40,
    paddingHorizontal: spacing(3),
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  snoozePanel: {
    gap: spacing(2),
    paddingTop: spacing(1),
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing(3.5),
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoRow: {
    flexDirection: 'row',
    marginTop: spacing(1),
  },
});
