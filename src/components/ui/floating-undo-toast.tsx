import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeOutDown,
  SlideInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedPressable } from './animated-pressable';
import { CONTENT_MAX_WIDTH, INK, PAPER, font, motion, radius, spacing, typography } from '../../theme/tokens';
import { useMotion } from '../../theme/use-motion';
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
  /** Distance from the bottom of the screen area (the docked tab bar is below it). */
  bottomOffset?: number;
};

/*
 * FloatingUndoToast — an ink capsule that rises above the tab bar after a
 * dose is confirmed. A hairline at its foot drains over the undo window
 * (a calm timer, not a countdown number).
 */
export function FloatingUndoToast({
  visible,
  message,
  undoLabel,
  dismissLabel,
  onUndo,
  onDismiss,
  durationMs = 8000,
  bottomOffset = 16,
}: FloatingUndoToastProps) {
  const { c, isDark } = useTokens();
  const { reduce } = useMotion();
  const progress = useSharedValue(1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      progress.value = 1;
      progress.value = withTiming(0, { duration: durationMs, easing: Easing.linear });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onDismiss(), durationMs);
    } else if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible, durationMs, onDismiss, progress]);

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  if (!visible) return null;

  // Always an ink capsule; in dark mode a lifted charcoal keeps it off the ground.
  const bg = isDark ? '#2A2E37' : INK;

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { bottom: bottomOffset }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        entering={reduce ? undefined : SlideInDown.springify().damping(24).stiffness(260)}
        exiting={FadeOutDown.duration(motion.duration.base)}
        style={[styles.container, { backgroundColor: bg }, styles.shadow]}
      >
        <View style={styles.contentRow}>
          <Animated.View
            entering={reduce ? undefined : ZoomIn.delay(160).springify().damping(18)}
            style={[styles.iconWrap, { backgroundColor: c.tones.sage.bg }]}
          >
            <Ionicons name="checkmark" size={16} color={c.tones.sage.fg} />
          </Animated.View>

          <Text numberOfLines={2} style={[typography.callout, styles.message, { color: PAPER }]}>
            {message}
          </Text>

          <AnimatedPressable
            onPress={onUndo}
            accessibilityRole="button"
            accessibilityLabel={`${undoLabel}: ${message}`}
            style={styles.undoButton}
          >
            <Ionicons name="arrow-undo" size={15} color={PAPER} />
            <Text style={[typography.subhead, { color: PAPER, fontFamily: font.bold }]}>{undoLabel}</Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            hitSlop={8}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={18} color="rgba(245,242,237,0.7)" />
          </AnimatedPressable>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { backgroundColor: c.accentSoft }, progressStyle]} />
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
    alignItems: 'center',
    paddingHorizontal: spacing(4),
    zIndex: 999,
  },
  container: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH - spacing(8),
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  shadow: {
    shadowColor: '#15171C',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing(4),
    paddingRight: spacing(2),
    paddingVertical: spacing(2.5),
    gap: spacing(3),
    minHeight: 64,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { flex: 1, minWidth: 0, fontFamily: font.medium },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    minHeight: 44,
    paddingHorizontal: spacing(4),
    borderRadius: radius.full,
    backgroundColor: 'rgba(245,242,237,0.14)',
  },
  closeButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: { height: 3, backgroundColor: 'rgba(245,242,237,0.1)' },
  progressBar: { height: 3 },
});
