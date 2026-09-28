import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Badge, type BadgeTone } from './badge';
import { AnimatedPressable } from './animated-pressable';
import { Button, type IconName } from './controls';
import { font, radius, spacing, typography } from '../../theme/tokens';
import { useMotion } from '../../theme/use-motion';
import { useTokens } from '../../theme/use-tokens';
import type { DoseOccurrence, DoseState, SkipReason } from '../../lib/takt/types';

type Pending = 'take' | 'skip' | 'snooze' | 'undo' | null;
type Panel = 'skip' | 'snooze' | null;

export type SkipReasonOption = { code: SkipReason; label: string };

type AnimatedDoseRowProps = {
  dose: DoseOccurrence;
  /** Kept for API compatibility; rows are separate cards now. */
  isFirst?: boolean;
  isFocused?: boolean;
  canUndo: boolean;
  stateLabel: string;
  /** "With food · with a glass of water", already localised. */
  instruction?: string;
  /** Second line under the strength: "Taken at 08:05" or "Skipped · Forgot". */
  detail?: string;
  /** Leading visual, normally the MedicationGlyph. */
  leading?: ReactNode;
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

const stateBadge = (state: DoseState): { tone: BadgeTone; icon?: IconName } => {
  if (state === 'taken') return { tone: 'success', icon: 'checkmark' };
  if (state === 'due') return { tone: 'accent', icon: 'time-outline' };
  if (state === 'missed') return { tone: 'destructive', icon: 'close' };
  if (state === 'skipped') return { tone: 'warning', icon: 'play-skip-forward' };
  return { tone: 'neutral' };
};

/*
 * One dose, one card. Every state carries its own visible action:
 * due → Taken / Snooze / Skip, missed → Mark as taken / Skip, scheduled →
 * Take early, taken or skipped → Undo for ten minutes.
 *
 * Confirming: the card washes to a soft sage, the badge swaps with a
 * small zoom and the name eases back, all under 200 ms and without
 * bounce (Calm UX C.19).
 */
export function AnimatedDoseRow({
  dose,
  isFocused = false,
  canUndo,
  stateLabel,
  instruction,
  detail,
  leading,
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
  const { c, isDark } = useTokens();
  const { duration, reduce } = useMotion();
  const [pending, setPending] = useState<Pending>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [snoozeMinutes, setSnoozeMinutes] = useState(defaultSnoozeMinutes);

  useEffect(() => setSnoozeMinutes(defaultSnoozeMinutes), [defaultSnoozeMinutes]);

  const pressScale = useSharedValue(1);
  // 0 → 1 while taken (sage wash), 0 → 1 while skipped (dimmed). Undo reverses both.
  const takenT = useSharedValue(dose.state === 'taken' ? 1 : 0);
  const skippedT = useSharedValue(dose.state === 'skipped' ? 1 : 0);

  useEffect(() => {
    takenT.value = withTiming(dose.state === 'taken' ? 1 : 0, { duration: duration.slow });
    skippedT.value = withTiming(dose.state === 'skipped' ? 1 : 0, { duration: duration.base });
  }, [dose.state, duration.base, duration.slow, skippedT, takenT]);

  const run = async (kind: Exclude<Pending, null>, action: () => Promise<void>) => {
    setPending(kind);
    try {
      await action();
    } finally {
      setPending(null);
    }
  };

  const handleTake = () => {
    // A single soft "press down and settle" on the whole card; no overshoot.
    pressScale.value = withSequence(withTiming(0.985, { duration: 90 }), withSpring(1, { damping: 26, stiffness: 300 }));
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

  const washed = isDark ? '#1C2922' : '#EDF6EE';
  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(takenT.value, [0, 1], [c.surface, washed]),
    opacity: 1 - skippedT.value * 0.35,
    transform: [{ scale: pressScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: 1 - takenT.value * 0.3 }));

  const detailColor = dose.state === 'taken' ? c.success : dose.state === 'skipped' ? c.warning : c.textSecondary;
  const locked = busy || pending !== null;
  const who = `${dose.label}, ${labels.time}`;
  const actionable = dose.state === 'due' || dose.state === 'missed';
  const primaryLabel = dose.state === 'missed' ? labels.markTaken : labels.confirmTaken;
  const badge = stateBadge(dose.state);
  const layout = reduce ? undefined : LinearTransition.springify().damping(24).stiffness(220);
  const panelIn = reduce ? undefined : FadeInDown.duration(220);
  const panelOut = reduce ? undefined : FadeOut.duration(120);

  return (
    <Animated.View
      layout={layout}
      style={[
        styles.card,
        {
          borderColor: isFocused ? c.accent : dose.state === 'due' ? c.textPrimary : 'transparent',
          borderWidth: isFocused || dose.state === 'due' ? 2 : 0,
        },
        cardStyle,
      ]}
    >
      <View style={styles.titleRow}>
        {leading}
        <Animated.View style={[styles.textCol, titleStyle]}>
          <Text numberOfLines={2} style={[typography.headline, styles.name, { color: c.textPrimary }]}>
            {dose.label}
          </Text>
          {[dose.strength, instruction].filter(Boolean).length ? (
            <Text style={[typography.subhead, { color: c.textSecondary }]}>
              {[dose.strength, instruction].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {detail ? (
            <Animated.Text
              key={detail}
              entering={reduce ? undefined : FadeIn.duration(220)}
              style={[typography.subhead, { color: detailColor, fontFamily: font.semibold, fontVariant: ['tabular-nums'] }]}
            >
              {detail}
            </Animated.Text>
          ) : null}
        </Animated.View>

        <View style={styles.badgesWrap}>
          {/* Keyed by state so a change swaps the badge with a small zoom. */}
          <Animated.View key={dose.state} entering={reduce ? undefined : ZoomIn.duration(180)}>
            {dose.state === 'scheduled' ? (
              <View style={[styles.timePill, { borderColor: c.separator }]}>
                <Text style={[typography.subhead, { color: c.textSecondary, fontFamily: font.semibold, fontVariant: ['tabular-nums'] }]}>
                  {labels.time}
                </Text>
              </View>
            ) : (
              <Badge label={stateLabel} tone={badge.tone} icon={badge.icon} size="sm" />
            )}
          </Animated.View>
          {isFocused && labels.contextBadge ? <Badge label={labels.contextBadge} tone="accent" size="sm" /> : null}
        </View>
      </View>

      {actionable ? (
        <Animated.View entering={panelIn} style={styles.actionsCol}>
          {/* One compact row: the confirm action leads, the two quieter ones follow. */}
          <View style={styles.pillRow}>
            <View style={{ flex: 1.35 }}>
              <Button
                size="sm"
                label={primaryLabel}
                icon={<Ionicons name="checkmark" size={18} color={c.onInk} />}
                loading={pending === 'take'}
                disabled={locked}
                haptic="success"
                accessibilityLabel={`${primaryLabel}, ${who}`}
                onPress={handleTake}
              />
            </View>
            {dose.state === 'due' ? (
              <View style={{ flex: 1 }}>
                <Button
                  kind="secondary"
                  size="sm"
                  label={labels.snooze}
                  disabled={locked}
                  accessibilityLabel={`${labels.snooze}, ${who}`}
                  onPress={() => setPanel((current) => (current === 'snooze' ? null : 'snooze'))}
                />
              </View>
            ) : null}
            <View style={{ flex: 0.85 }}>
              <Button
                kind="outline"
                size="sm"
                label={labels.markSkipped}
                loading={pending === 'skip'}
                disabled={locked}
                haptic="warning"
                accessibilityLabel={`${labels.markSkipped}, ${who}`}
                onPress={handleSkipPress}
              />
            </View>
          </View>

          {panel === 'skip' ? (
            <Animated.View entering={panelIn} exiting={panelOut} style={styles.panel}>
              {labels.skipReasonPrompt ? (
                <Text style={[typography.subhead, { color: c.textSecondary }]}>{labels.skipReasonPrompt}</Text>
              ) : null}
              <View style={styles.chipRow}>
                {skipReasons.map((reason, i) => (
                  <Animated.View key={reason.code} entering={reduce ? undefined : FadeIn.delay(35 * i).duration(160)}>
                    <AnimatedPressable
                      onPress={() => void skipWith(reason.code)}
                      disabled={locked}
                      accessibilityRole="button"
                      accessibilityLabel={`${labels.markSkipped}: ${reason.label}, ${who}`}
                      style={[styles.chip, { backgroundColor: c.surfaceRaised }]}
                    >
                      <Text style={[typography.subhead, { color: c.textPrimary, fontFamily: font.semibold }]}>{reason.label}</Text>
                    </AnimatedPressable>
                  </Animated.View>
                ))}
              </View>
              <Button
                size="sm"
                kind="ghost"
                fullWidth={false}
                label={labels.cancel}
                disabled={pending === 'skip'}
                accessibilityLabel={`${labels.cancel} ${labels.markSkipped}, ${who}`}
                onPress={() => setPanel(null)}
              />
            </Animated.View>
          ) : null}

          {panel === 'snooze' ? (
            <Animated.View entering={panelIn} exiting={panelOut} style={styles.panel}>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{labels.snoozeRemindIn}</Text>
              <View style={styles.chipRow}>
                {snoozeOptions.map((minutes) => {
                  const selected = minutes === snoozeMinutes;
                  return (
                    <AnimatedPressable
                      key={minutes}
                      onPress={() => setSnoozeMinutes(minutes)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${labels.snooze} ${minutes} min, ${who}`}
                      style={[styles.chip, { backgroundColor: selected ? c.ink : c.surfaceRaised }]}
                    >
                      <Text
                        style={[
                          typography.subhead,
                          { color: selected ? c.onInk : c.textPrimary, fontFamily: selected ? font.bold : font.semibold },
                        ]}
                      >
                        {`${minutes} min`}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
              <View style={styles.pillRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    size="sm"
                    label={labels.snooze}
                    loading={pending === 'snooze'}
                    disabled={locked}
                    accessibilityLabel={`${labels.snooze} ${snoozeMinutes} min, ${who}`}
                    onPress={() => void confirmSnooze()}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    size="sm"
                    kind="secondary"
                    label={labels.cancel}
                    disabled={pending === 'snooze'}
                    accessibilityLabel={`${labels.cancel} ${labels.snooze}, ${who}`}
                    onPress={() => setPanel(null)}
                  />
                </View>
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}

      {dose.state === 'scheduled' || canUndo ? (
        <View style={styles.quietRow}>
          {dose.state === 'scheduled' ? (
            <AnimatedPressable
              onPress={handleTake}
              disabled={locked}
              haptic="success"
              accessibilityRole="button"
              accessibilityLabel={`${labels.takeEarly}, ${who}`}
              accessibilityState={{ disabled: locked, busy: pending === 'take' }}
              style={[styles.quietPill, { backgroundColor: c.surfaceRaised }]}
            >
              {pending === 'take' ? (
                <ActivityIndicator size="small" color={c.textPrimary} />
              ) : (
                <Ionicons name="checkmark" size={18} color={c.textPrimary} />
              )}
              <Text style={[typography.subhead, { color: c.textPrimary, fontFamily: font.semibold }]}>{labels.takeEarly}</Text>
            </AnimatedPressable>
          ) : null}
          {canUndo ? (
            <Animated.View entering={reduce ? undefined : FadeIn.delay(200).duration(200)}>
              <AnimatedPressable
                onPress={() => void run('undo', onUndo)}
                disabled={locked}
                accessibilityRole="button"
                accessibilityLabel={`${labels.undo}, ${who}`}
                accessibilityState={{ disabled: locked, busy: pending === 'undo' }}
                style={[styles.quietPill, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.separator }]}
              >
                {pending === 'undo' ? (
                  <ActivityIndicator size="small" color={c.textSecondary} />
                ) : (
                  <Ionicons name="arrow-undo" size={16} color={c.textSecondary} />
                )}
                <Text style={[typography.subhead, { color: c.textSecondary, fontFamily: font.semibold }]}>{labels.undo}</Text>
              </AnimatedPressable>
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing(3),
    gap: spacing(2.5),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: font.bold },
  badgesWrap: { alignItems: 'flex-end', gap: spacing(1.5) },
  timePill: {
    minHeight: 28,
    paddingHorizontal: spacing(3),
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsCol: { gap: spacing(2) },
  pillRow: { flexDirection: 'row', gap: spacing(2) },
  panel: { gap: spacing(2.5), paddingTop: spacing(1) },
  chipRow: { flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing(4),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quietRow: { flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' },
  quietPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    minHeight: 40,
    paddingHorizontal: spacing(3.5),
    borderRadius: radius.full,
  },
});
