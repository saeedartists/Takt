/*
 * Single import site for the mobile design system.
 *
 *   import { Card, MetricTile, ListGroup, ListRow } from '@/components/ui';
 *
 * Mirrors the web scaffold's barrel so a chat building both surfaces
 * uses the same names on both. Add new primitives here rather than
 * deep-importing — the main reason a model reinvents a component is
 * not knowing one already shipped.
 */
export { Card, SectionHeader } from './card';
export { MetricTile } from './metric-tile';
export { ListGroup, ListRow } from './list-row';
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
