import { LinearTransition } from 'react-native-reanimated';

import { motion, type BadgeTone, type IconName } from '@/components/ui';
import { semantic } from '@/theme/tokens';
import type { DoseOccurrence } from '@/lib/takt/types';

/* Shared shapes and metadata for the history screen's split components. */

export type CorrectionAction = 'taken' | 'skipped' | 'missed';
export type DoseWithDay = DoseOccurrence & { dayLabel: string };

/*
 * One meaning per tone: sage = taken, butter = skipped, rose = missed.
 * The segmented thumb uses the light-mode solids so its white label stays
 * AA in dark mode too.
 */
export const STATE_META: Record<CorrectionAction, { badge: BadgeTone; icon: IconName; thumb: string }> = {
  taken: { badge: 'success', icon: 'checkmark', thumb: semantic.light.tones.sage.solid },
  skipped: { badge: 'warning', icon: 'pause', thumb: semantic.light.tones.butter.solid },
  missed: { badge: 'destructive', icon: 'close', thumb: semantic.light.tones.rose.solid },
};

/** Shared layout glide: list edits reflow with the same settle spring. */
export const historyLayoutGlide = LinearTransition.springify()
  .damping(motion.spring.settle.damping)
  .stiffness(motion.spring.settle.stiffness);
