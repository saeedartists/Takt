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
import type { DoseOccurrence, DoseState, SkipReason } from '../../lib/takt/types';

type Pending = 'take' | 'skip' | 'snooze' | 'undo' | null;
type Panel = 'skip' | 'snooze' | null;

export type SkipReasonOption = { code: SkipReason; label: string };

type AnimatedDoseRowProps = {
  dose: DoseOccurrence;
  isFirst?: boolean;
  isFocused?: boolean;
  canUndo: boolean;
  stateLabel: string;
  /** Second line under the strength: "Taken at 08:05" or "Skipped · Forgot". */
  detail?: string;
  onTake: () => Promise<void>;
  /** Skip with the reason the user picked; undefined when no reason list is offered. */
  onSkip: (reason?: SkipReason) => Promise<void>;
  onSnooze: (minutes: number) => Promise<void>;
  onUndo: () => Promise<void>;
  busy?: boolean;
  snoozeOptions?: number[];
  defaultSnoozeMinutes: number;
  /** When given, Skip opens a reason picker instead of skipping straight away. */
  skipReasons?: SkipReasonOption[];
  labels: {
    /** Formatted scheduled time, used in accessibility labels. */
    time: string;
    confirmTaken: string;
    /** Primary action on a missed dose. */
    markTaken: string;
    /** Quiet action on a dose that is not due yet. */
    takeEarly: string;
    markSkipped: string;
    snooze: string;
    snoozeRemindIn: string;
    skipReasonPrompt?: string;
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

/*
 * Every state carries its own visible action: due → Take / Skip / Snooze,
 * missed → Mark as taken / Skip, scheduled → Take early, taken or
 * skipped → Undo for ten minutes. Nothing hides behind a tap on the row.
 */
export function AnimatedDoseRow({
  dose,
  isFirst = false,
  isFocused = false,
  canUndo,
  stateLabel,
  detail,
  onTake,
  onSkip,
  onSnooze,
  onUndo,
  busy = false,
  snoozeOptions = [5, 10, 15, 30],
  defaultSnoozeMinutes,
  skipReasons = [],
  labels,
}: AnimatedDoseRowProps) {
  const { c } = useTokens();
  const { spring, duration } = useMotion();
  const [pending, setPending] = useState<Pending>(null);
  const [panel, setPanel] = useState<Panel>(null);
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

  const handleSkipPress = () => {
    if (skipReasons.length === 0) {
      void run('skip', () => onSkip());
      return;
    }
    setPanel((current) => (current === 'skip' ? null : 'skip'));
  };

  const skipWith = async (reason: SkipReason) => {
    await run('skip', () => onSkip(reason));
    setPanel(null);
  };

  const confirmSnooze = async () => {
    await run('snooze', () => onSnooze(snoozeMinutes));
    setPanel(null);
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
  const detailColor = dose.state === 'taken' ? c.success : dose.state === 'skipped' ? c.warning : c.textSecondary;

  const locked = busy || pending !== null;
  const who = `${dose.label}, ${labels.time}`;
  const actionable = dose.state === 'due' || dose.state === 'missed';
  const primaryLabel = dose.state === 'missed' ? labels.markTaken : labels.confirmTaken;

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
            <Text numberOfLines={2} style={[typography.headline, { color: c.textPrimary }]}>
              {dose.label}
            </Text>
            {dose.strength ? (
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{dose.strength}</Text>
            ) : null}
            {detail ? (
              <Text style={[typography.footnote, { color: detailColor, fontWeight: '600', fontVariant: ['tabular-nums'] }]}>
                {detail}
              </Text>
            ) : null}
          </Animated.View>

          <View style={styles.badgesWrap}>
            <Badge label={stateLabel} tone={stateTone(dose.state)} />
            {isFocused && labels.contextBadge ? (
              <Badge label={labels.contextBadge} tone="accent" />
            ) : null}
          </View>
        </View>

        {actionable ? (
          <View style={styles.dueActionsCol}>
            <AnimatedPressable
              onPress={handleTake}
              disabled={locked}
              haptic="success"
              accessibilityRole="button"
              accessibilityLabel={`${primaryLabel}, ${who}`}
              accessibilityState={{ disabled: locked, busy: pending === 'take' }}
              style={[styles.primaryAction, { backgroundColor: c.accent }]}
            >
              <Animated.View style={[styles.actionInner, checkAnimStyle]}>
                {pending === 'take' ? (
                  <ActivityIndicator color={c.surface} />
                ) : (
                  <Ionicons name="checkmark" size={18} color={c.surface} />
                )}
                <Text style={[typography.headline, { color: c.surface, fontWeight: '600' }]}>{primaryLabel}</Text>
              </Animated.View>
            </AnimatedPressable>

            <View style={styles.pillActionsRow}>
              <AnimatedPressable
                onPress={handleSkipPress}
                disabled={locked}
                haptic="warning"
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`${labels.markSkipped}, ${who}`}
                accessibilityState={{ disabled: locked, busy: pending === 'skip', expanded: panel === 'skip' }}
                style={[
                  styles.secondaryPill,
                  { backgroundColor: `${c.warning}1A`, borderColor: panel === 'skip' ? c.warning : `${c.warning}44` },
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

              {dose.state === 'due' ? (
                <AnimatedPressable
                  onPress={() => setPanel((current) => (current === 'snooze' ? null : 'snooze'))}
                  disabled={locked}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`${labels.snooze}, ${who}`}
                  accessibilityState={{ disabled: locked, expanded: panel === 'snooze' }}
                  style={[
                    styles.secondaryPill,
                    { backgroundColor: `${c.accent}1A`, borderColor: panel === 'snooze' ? c.accent : `${c.accent}44` },
                  ]}
                >
                  <Ionicons name="alarm-outline" size={15} color={c.accent} />
                  <Text style={[typography.footnote, { color: c.accent, fontWeight: '600' }]}>
                    {labels.snooze}
                  </Text>
                </AnimatedPressable>
              ) : null}
            </View>

            {panel === 'skip' ? (
              <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.panel}>
                {labels.skipReasonPrompt ? (
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>{labels.skipReasonPrompt}</Text>
                ) : null}
                <View style={styles.pillActionsRow}>
                  {skipReasons.map((reason) => (
                    <AnimatedPressable
                      key={reason.code}
                      onPress={() => void skipWith(reason.code)}
                      disabled={locked}
                      accessibilityRole="button"
                      accessibilityLabel={`${labels.markSkipped}: ${reason.label}, ${who}`}
                      style={[styles.chip, { backgroundColor: c.surfaceRaised, borderColor: c.separator }]}
                    >
                      <Text style={[typography.subhead, { color: c.textPrimary, fontWeight: '600' }]}>
                        {reason.label}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </View>
                <View style={styles.pillActionsRow}>
                  <Button
                    size="sm"
                    kind="secondary"
                    label={labels.cancel}
                    disabled={pending === 'skip'}
                    accessibilityLabel={`${labels.cancel} ${labels.markSkipped}, ${who}`}
                    onPress={() => setPanel(null)}
                  />
                </View>
              </Animated.View>
            ) : null}

            {panel === 'snooze' ? (
              <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.panel}>
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
                    onPress={() => setPanel(null)}
                  />
                </View>
              </Animated.View>
            ) : null}
          </View>
        ) : dose.state === 'scheduled' ? (
          <View style={styles.pillActionsRow}>
            <AnimatedPressable
              onPress={handleTake}
              disabled={locked}
              haptic="success"
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`${labels.takeEarly}, ${who}`}
              accessibilityState={{ disabled: locked, busy: pending === 'take' }}
              style={[styles.secondaryPill, { backgroundColor: `${c.accent}14`, borderColor: `${c.accent}33` }]}
            >
              {pending === 'take' ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={15} color={c.accent} />
              )}
              <Text style={[typography.footnote, { color: c.accent, fontWeight: '600' }]}>{labels.takeEarly}</Text>
            </AnimatedPressable>
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
  panel: {
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
