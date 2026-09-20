import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

/*
 * ListGroup + ListRow — the Health "Browse" pattern.
 *
 * ListGroup owns the card and draws hairlines BETWEEN rows only (never
 * after the last), which is the detail that makes an iOS list look
 * right. Rows honour the 44pt minimum touch target.
 */
export const ListGroup = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) => {
  const { c, scheme } = useTokens();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.cardBorder,
          overflow: 'hidden',
        },
        scheme === 'light' && styles.lightShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const ListRow = ({
  title,
  subtitle,
  meta,
  value,
  leading,
  onPress,
  trailing,
  isFirst = false,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  /** Optional third line: a string (tertiary footnote) or a node such as a Badge. */
  meta?: ReactNode;
  value?: string;
  leading?: ReactNode;
  onPress?: () => void;
  trailing?: ReactNode;
  /** Suppresses the top hairline. Set on the first row of a group. */
  isFirst?: boolean;
  accessibilityLabel?: string;
}) => {
  const { c } = useTokens();

  const body = (
    <>
      {leading ? <View>{leading}</View> : null}
      <View style={styles.textCol}>
        <Text numberOfLines={2} style={[typography.body, { color: c.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[typography.footnote, { color: c.textSecondary }]}
          >
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          typeof meta === 'string' ? (
            <Text numberOfLines={1} style={[typography.footnote, styles.meta, { color: c.textTertiary }]}>
              {meta}
            </Text>
          ) : (
            <View style={styles.meta}>{meta}</View>
          )
        ) : null}
      </View>
      {trailing ??
        (value ? (
          <Text
            style={[
              typography.body,
              { color: c.textSecondary, fontVariant: ['tabular-nums'] },
            ]}
          >
            {value}
          </Text>
        ) : null)}
      {onPress ? (
        <Text style={[typography.body, { color: c.textTertiary }]}>›</Text>
      ) : null}
    </>
  );

  const rowStyle = [
    styles.row,
    !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
  ];

  if (!onPress) return <View style={rowStyle}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        ...rowStyle,
        pressed && { backgroundColor: c.background },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
    >
      {body}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  textCol: { flex: 1, minWidth: 0 },
  meta: { marginTop: spacing(1), alignSelf: 'flex-start' },
  lightShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
