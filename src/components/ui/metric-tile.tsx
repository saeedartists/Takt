import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import {
  categoryColors,
  radius,
  spacing,
  typography,
  type HealthCategory,
} from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import { Card } from './card';

/*
 * MetricTile — the signature Apple Health card, mobile mirror.
 *
 *   [chip] CATEGORY LABEL          timestamp
 *   1 2 6 / 8 0  mmHg
 *   optional trend + footer (sparkline)
 *
 * Category colour tints the chip AND the label; that colour coding is
 * what makes a Health summary scannable before a word is read.
 */
export const MetricTile = ({
  category,
  label,
  value,
  unit,
  timestamp,
  icon,
  trend,
  footer,
  style,
}: {
  category: HealthCategory;
  label: string;
  /** Pre-formatted. This component does not do maths. */
  value: string | number;
  unit?: string;
  timestamp?: string;
  icon?: ReactNode;
  trend?: { direction: 'up' | 'down' | 'flat'; text: string };
  footer?: ReactNode;
  style?: ViewStyle;
}) => {
  const { c } = useTokens();
  const tint = categoryColors[category];

  return (
    <Card style={style}>
      <View style={{ padding: spacing(4) }}>
        <View style={styles.topRow}>
          <View style={styles.labelGroup}>
            {icon ? (
              <View style={[styles.chip, { backgroundColor: `${tint}1F` }]}>
                {icon}
              </View>
            ) : null}
            <Text
              numberOfLines={1}
              style={[
                typography.footnote,
                styles.label,
                { color: tint },
              ]}
            >
              {label.toUpperCase()}
            </Text>
          </View>
          {timestamp ? (
            <Text style={[typography.caption, { color: c.textTertiary }]}>
              {timestamp}
            </Text>
          ) : null}
        </View>

        <View style={styles.valueRow}>
          <Text
            style={[
              typography.metric,
              { color: c.textPrimary, fontVariant: ['tabular-nums'] },
            ]}
          >
            {value}
          </Text>
          {unit ? (
            <Text style={[typography.callout, { color: c.textSecondary }]}>
              {unit}
            </Text>
          ) : null}
        </View>

        {trend ? (
          <Text style={[typography.footnote, styles.trend, { color: c.textSecondary }]}>
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}{' '}
            {trend.text}
          </Text>
        ) : null}

        {footer ? <View style={{ marginTop: spacing(3) }}>{footer}</View> : null}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing(3),
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    flexShrink: 1,
  },
  chip: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: '600', letterSpacing: 0.4, flexShrink: 1 },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing(1.5),
    marginTop: spacing(3),
  },
  trend: { marginTop: spacing(1.5) },
});
