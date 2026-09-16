import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from './badge';
import { AnimatedPressable } from './animated-pressable';
import { radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import type { DoseOccurrence, DoseState } from '../../lib/takt/types';

type AnimatedDoseRowProps = {
  dose: DoseOccurrence;
  isFirst?: boolean;
  isFocused?: boolean;
  canUndo: boolean;
  stateLabel: string;
  onTake: () => Promise<void>;
  onSkip: () => Promise<void>;
  onSnooze: () => Promise<void>;
  onUndo: () => Promise<void>;
  busy?: boolean;
  labels: {
    confirmTaken: string;
    markSkipped: string;
    snooze: string;
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
  labels,
}: AnimatedDoseRowProps) {
  const { c } = useTokens();
  const [taking, setTaking] = useState(false);

  const checkScale = useSharedValue(1);

  const handleTake = async () => {
    setTaking(true);
    checkScale.value = withSequence(
      withSpring(1.2, { damping: 10, stiffness: 300 }),
      withSpring(1, { damping: 14, stiffness: 200 }),
    );
    try {
      await onTake();
    } finally {
      setTaking(false);
    }
  };

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

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

  return (
    <View
      style={[
        styles.row,
        isFocused && { backgroundColor: c.surfaceRaised },
        !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
      ]}
    >
      <View style={[styles.rail, { backgroundColor: railBg }]} />

      <View style={styles.contentCol}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={[typography.headline, { color: c.textPrimary }]}>
              {dose.label}
            </Text>
            {dose.strength ? (
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{dose.strength}</Text>
            ) : null}
          </View>

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
              onPress={() => void handleTake()}
              disabled={busy || taking}
              style={[styles.primaryAction, { backgroundColor: c.accent }]}
            >
              <Animated.View style={[styles.actionInner, checkAnimStyle]}>
                <Ionicons name="checkmark" size={18} color={c.surface} />
                <Text style={[typography.headline, { color: c.surface, fontWeight: '600' }]}>
                  {labels.confirmTaken}
                </Text>
              </Animated.View>
            </AnimatedPressable>

            <View style={styles.pillActionsRow}>
              <AnimatedPressable
                onPress={() => void onSkip()}
                disabled={busy}
                style={[
                  styles.secondaryPill,
                  { backgroundColor: `${c.warning}1A`, borderColor: `${c.warning}44` },
                ]}
              >
                <Ionicons name="close-circle-outline" size={15} color={c.warning} />
                <Text style={[typography.footnote, { color: c.warning, fontWeight: '600' }]}>
                  {labels.markSkipped}
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => void onSnooze()}
                disabled={busy}
                style={[
                  styles.secondaryPill,
                  { backgroundColor: `${c.accent}1A`, borderColor: `${c.accent}44` },
                ]}
              >
                <Ionicons name="alarm-outline" size={15} color={c.accent} />
                <Text style={[typography.footnote, { color: c.accent, fontWeight: '600' }]}>
                  {labels.snooze}
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        ) : null}

        {canUndo ? (
          <View style={styles.undoRow}>
            <AnimatedPressable
              onPress={() => void onUndo()}
              disabled={busy}
              style={[
                styles.secondaryPill,
                { backgroundColor: `${c.accent}14`, borderColor: `${c.accent}33` },
              ]}
            >
              <Ionicons name="arrow-undo" size={14} color={c.accent} />
              <Text style={[typography.footnote, { color: c.accent, fontWeight: '600' }]}>
                {labels.undo}
              </Text>
            </AnimatedPressable>
          </View>
        ) : null}
      </View>
    </View>
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
    minHeight: 36,
    paddingHorizontal: spacing(3),
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  undoRow: {
    flexDirection: 'row',
    marginTop: spacing(1),
  },
});
