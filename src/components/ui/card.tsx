import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

/*
 * Card — the fundamental Health container. Nearly flat, generously
 * rounded, sitting on the grouped background. Mirror of the web
 * scaffold's Card.
 */
export const Card = ({
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
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.separator,
        },
        // Health cards are flat on black; a soft shadow only reads in light.
        scheme === 'light' && [styles.lightShadow, { shadowColor: c.textPrimary }],
        style,
      ]}
    >
      {children}
    </View>
  );
};

/** Section title ABOVE a card — the Health pattern, not inside it. */
export const SectionHeader = ({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) => {
  const { c } = useTokens();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[typography.title3, { color: c.textPrimary }]}>{title}</Text>
      {action}
    </View>
  );
};

const styles = StyleSheet.create({
  lightShadow: {
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
    paddingHorizontal: spacing(1),
  },
});
