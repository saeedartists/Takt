import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { useLocale } from '../../lib/takt/l10n';
import { INK, radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import { Button } from './controls';

/*
 * EmptyState / ErrorState / LoadingState.
 *
 * Rule: every data-backed screen renders one of
 * {loading, error, empty, content}. Never just {content}.
 */

export const LoadingState = ({ label }: { label?: string }) => {
  const { c } = useTokens();
  return (
    <Animated.View entering={FadeIn.delay(150).duration(250)} style={styles.box}>
      <ActivityIndicator color={c.textSecondary} />
      {label ? (
        <Text style={[typography.subhead, styles.mt, { color: c.textSecondary }]}>
          {label}
        </Text>
      ) : null}
    </Animated.View>
  );
};

/** The brand "rhythm" mark: a capsule, a soft circle and the beat dot. */
const RhythmArt = () => {
  const { c } = useTokens();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={104} height={72} viewBox="0 0 104 72">
      <G transform="rotate(-24 30 36)">
        <Rect x={6} y={24} width={52} height={26} rx={13} fill={c.accentSoft} />
        <Path d="M32 24v26" stroke={c.surface} strokeWidth={3} />
      </G>
      <Circle cx={72} cy={40} r={20} fill={c.tones.sky.bg} />
      <Circle cx={92} cy={14} r={6} fill={c.textPrimary} />
    </Svg>
    </View>
  );
};

export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  /** Say what would put data here, not just "no data". */
  description?: string;
  action?: ReactNode;
}) => {
  const { c } = useTokens();
  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      style={[styles.box, styles.panel, { backgroundColor: c.surface }]}
    >
      <RhythmArt />
      <Text style={[typography.title3, styles.mtLg, styles.center, { color: c.textPrimary }]}>{title}</Text>
      {description ? (
        <Text style={[typography.callout, styles.mt, styles.center, { color: c.textSecondary }]}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={styles.mtLg}>{action}</View> : null}
    </Animated.View>
  );
};

export const ErrorState = ({
  title,
  description,
  onRetry,
  retryLabel,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) => {
  const { c } = useTokens();
  const { t } = useLocale();
  const heading = title ?? t('couldNotLoad');
  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      accessibilityRole="alert"
      style={[styles.box, styles.panel, { backgroundColor: c.tones.rose.bg }]}
    >
      <View style={[styles.errorIcon, { backgroundColor: 'rgba(255,255,255,0.72)' }]}>
        <Ionicons name="cloud-offline-outline" size={24} color={c.tones.rose.fg} />
      </View>
      <Text style={[typography.title3, styles.mt, styles.center, { color: INK }]}>{heading}</Text>
      {description ? (
        <Text style={[typography.callout, styles.mt, styles.center, { color: c.tones.rose.fg }]}>
          {description}
        </Text>
      ) : null}
      {onRetry ? (
        <View style={styles.mtLg}>
          <Button
            label={retryLabel ?? t('tryAgain')}
            kind="primary"
            size="sm"
            fullWidth={false}
            onPress={onRetry}
            icon={<Ionicons name="refresh" size={18} color={c.onInk} />}
          />
        </View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(8),
  },
  panel: { borderRadius: radius.xl },
  errorIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  mt: { marginTop: spacing(2) },
  mtLg: { marginTop: spacing(4) },
  center: { textAlign: 'center' },
});
