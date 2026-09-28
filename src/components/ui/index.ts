/*
 * Single import site for the mobile design system.
 *
 *   import { Card, ListGroup, ListRow } from '@/components/ui';
 *
 * Mirrors the web scaffold's barrel so a chat building both surfaces
 * uses the same names on both. Add new primitives here rather than
 * deep-importing — the main reason a model reinvents a component is
 * not knowing one already shipped.
 */
export { Card, SectionHeader, Tile, TileIcon, useTileColors, type TileTone } from './card';
export { ListGroup, ListRow } from './list-row';
export { Skeleton, SkeletonCard, SkeletonRow } from './skeleton';
export { EmptyState, ErrorState, LoadingState } from './states';
export { Sparkline } from './sparkline';
export { PageShell, PageHeader, Stack } from './page';
export {
  categoryColors,
  radius,
  spacing,
  typography,
  MIN_TOUCH_TARGET,
  type HealthCategory,
} from '../../theme/tokens';
export { useTokens } from '../../theme/use-tokens';
export { useMotion } from '../../theme/use-motion';
export { motion, CONTENT_MAX_WIDTH, font, weight, INK, PAPER, type ToneName, type Tone, type SemanticColors } from '../../theme/tokens';

export { Field, Input, SegmentedControl, Button, IconButton, type IconName, type ButtonKind } from './controls';
export { PillIcon, TaktMark } from './brand-icons';
export { Badge, type BadgeTone } from './badge';
export { AnimatedPressable, triggerHaptic, type HapticKind } from './animated-pressable';
export { AnimatedSegmentedControl } from './animated-segmented-control';
export { AnimatedProgressBar } from './animated-progress-bar';
export { AnimatedDoseRow } from './animated-dose-row';
export { TodayHeroCard, type HeroPending } from './today-hero-card';
export { FloatingUndoToast } from './floating-undo-toast';
export { WeekStripPicker } from './week-strip-picker';
export { useTheme } from '../../theme/theme-context';
export { paletteConfigs, type ThemePalette, type ThemeMode } from '../../theme/tokens';

export { StackHeader } from './stack-header';
export { AnimatedNumber, ProgressRing } from './animated-metrics';
