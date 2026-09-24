import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from './animated-pressable';
import { CONTENT_MAX_WIDTH, motion, radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

type FloatingUndoToastProps = {
  visible: boolean;
  message: string;
  undoLabel: string;
  /** Screen-reader label for the close button. */
  dismissLabel: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
};

export function FloatingUndoToast({
  visible,
  message,
  undoLabel,
  dismissLabel,
  onUndo,
  onDismiss,
  durationMs = 8000,
}: FloatingUndoToastProps) {
  const { c, scheme } = useTokens();
  const progress = useSharedValue(1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      progress.value = 1;
      progress.value = withTiming(0, { duration: durationMs });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onDismiss();
      }, durationMs);
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible, durationMs, onDismiss, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (!visible) return null;

  return (
    // Full-width overlay so the toast is never clipped by the reading column; the card inside is capped.
    <View pointerEvents="box-none" style={styles.overlay}>
      <Animated.View
        accessibilityLiveRegion="polite"
        entering={FadeInDown.springify()
          .damping(motion.spring.gentle.damping)
          .stiffness(motion.spring.gentle.stiffness)}
        exiting={FadeOutDown.duration(motion.duration.base)}
        style={[
          styles.container,
          {
            backgroundColor: c.surface,
            borderColor: c.separator,
          },
          scheme === 'light' && styles.lightShadow,
        ]}
      >
        <View style={styles.contentRow}>
          <View style={[styles.iconWrap, { backgroundColor: `${c.success}1A` }]}>
            <Ionicons name="checkmark-circle" size={20} color={c.success} />
          </View>

          <Text numberOfLines={2} style={[typography.subhead, styles.message, { color: c.textPrimary }]}>
            {message}
          </Text>

          <AnimatedPressable
            onPress={onUndo}
            accessibilityRole="button"
            accessibilityLabel={`${undoLabel}: ${message}`}
            style={[styles.undoButton, { backgroundColor: `${c.accent}1F`, borderColor: `${c.accent}44` }]}
          >
            <Text style={[typography.footnote, { color: c.accent, fontWeight: '700' }]}>{undoLabel}</Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            hitSlop={8}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={18} color={c.textTertiary} />
          </AnimatedPressable>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: c.surfaceRaised }]}>
          <Animated.View style={[styles.progressBar, { backgroundColor: c.accent }, progressStyle]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing(6),
    alignItems: 'center',
    paddingHorizontal: spacing(4),
    zIndex: 999,
  },
  container: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH - spacing(8),
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
    gap: spacing(2.5),
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    minWidth: 0,
    fontWeight: '500',
  },
  undoButton: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    padding: spacing(1),
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressBar: {
    height: '100%',
  },
  lightShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
