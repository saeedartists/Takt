import { useMemo } from 'react';
import { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { motion } from './tokens';

/*
 * useMotion — the one place screens ask "how should this move?".
 *
 * Reanimated already snaps withSpring / withTiming / entering animations
 * to their end state under the OS reduce-motion setting. This hook covers
 * what it can't: stagger delays, our own timers, and giving every list
 * the same entrance.
 */
export const useMotion = () => {
  const reduce = useReducedMotion();

  return useMemo(() => {
    const stagger = (index: number): number =>
      reduce ? 0 : Math.min(index, motion.staggerMax) * motion.stagger;

    return {
      reduce,
      spring: motion.spring,
      duration: reduce ? { fast: 0, base: 0, slow: 0 } : motion.duration,
      stagger,
      /** Standard list-item entrance: `<Animated.View entering={enter(i)}>`. */
      enter: (index = 0) =>
        FadeInDown.delay(stagger(index))
          .springify()
          .damping(motion.spring.gentle.damping)
          .stiffness(motion.spring.gentle.stiffness),
    };
  }, [reduce]);
};
