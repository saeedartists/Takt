import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  MIN_TOUCH_TARGET,
  radius,
  spacing,
  typography,
} from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

/*
 * EmptyState / ErrorState / LoadingState — shipped as primitives for
 * the same reason as on web: their absence is what makes a generated
 * app feel broken. An empty list with no explanation is
 * indistinguishable from a failed fetch.
 *
 * Rule: every data-backed screen renders one of
 * {loading, error, empty, content}. Never just {content}.
 */

export const LoadingState = ({ label }: { label?: string }) => {
  const { c } = useTokens();
  return (
    <View style={styles.box}>
      <ActivityIndicator />
      {label ? (
        <Text style={[typography.subhead, styles.mt, { color: c.textSecondary }]}>
          {label}
        </Text>
      ) : null}
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
    <View
      style={[
        styles.box,
        {
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.separator,
        },
      ]}
    >
      <Text style={[typography.headline, { color: c.textPrimary }]}>{title}</Text>
      {description ? (
        <Text
          style={[typography.subhead, styles.mt, styles.center, { color: c.textSecondary }]}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={styles.mt}>{action}</View> : null}
    </View>
  );
};

export const ErrorState = ({
  title = 'Couldn’t load this',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) => {
  const { c } = useTokens();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.box,
        {
          backgroundColor: `${c.destructive}0A`,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${c.destructive}33`,
        },
      ]}
    >
      <Text style={[typography.headline, { color: c.textPrimary }]}>{title}</Text>
      {description ? (
        <Text
          style={[typography.subhead, styles.mt, styles.center, { color: c.textSecondary }]}
        >
          {description}
        </Text>
      ) : null}
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.retry,
            { backgroundColor: pressed ? `${c.accent}22` : `${c.accent}14` },
          ]}
        >
          <Text style={[typography.subhead, { color: c.accent, fontWeight: '600' }]}>
            Try again
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(10),
  },
  mt: { marginTop: spacing(2) },
  center: { textAlign: 'center' },
  retry: {
    marginTop: spacing(4),
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
    borderRadius: radius.md,
  },
});
