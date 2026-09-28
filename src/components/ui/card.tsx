import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, typography, type ToneName } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import { AnimatedPressable } from './animated-pressable';
import type { IconName } from './controls';

/*
 * Card — the white container on the paper ground. Flat, generously
 * rounded; dark mode adds a hairline instead of a shadow.
 */
export const Card = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const { c, isDark } = useTokens();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.xl,
          borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
          borderColor: c.cardBorder,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export type TileTone = ToneName | 'accent' | 'surface';

/** Resolve a tile tone to its fill / deep text pair. */
export const useTileColors = (tone: TileTone) => {
  const { c } = useTokens();
  if (tone === 'surface') return { bg: c.surface, fg: c.textSecondary, ink: c.textPrimary };
  if (tone === 'accent') return { bg: c.accentSoft, fg: c.onAccentSoft, ink: '#15171C' };
  return { bg: c.tones[tone].bg, fg: c.tones[tone].fg, ink: '#15171C' };
};

/*
 * Tile — a pastel bento block. The tone carries the meaning (see
 * tokens.ts); text on it is ink with the tone's deep colour for
 * secondary lines. Pressable when given onPress.
 */
export const Tile = ({
  tone,
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
}: {
  tone: TileTone;
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) => {
  const colors = useTileColors(tone);
  const base = [styles.tile, { backgroundColor: colors.bg }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="light"
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={base}
    >
      {children}
    </AnimatedPressable>
  );
};

/** The small white-glass circle holding an icon in a tile's corner. */
export const TileIcon = ({ name, color = '#15171C', size = 40 }: { name: IconName; color?: string; size?: number }) => (
  <View style={[styles.tileIcon, { width: size, height: size, borderRadius: size / 2 }]}>
    <Ionicons name={name} size={Math.round(size * 0.5)} color={color} />
  </View>
);

/** Section title ABOVE a card: display face, optional trailing action. */
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
      <Text accessibilityRole="header" style={[typography.title2, { color: c.textPrimary, flex: 1 }]}>
        {title}
      </Text>
      {action}
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.xl,
    padding: spacing(4.5),
    overflow: 'hidden',
  },
  tileIcon: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(3),
    marginBottom: spacing(3),
    paddingHorizontal: spacing(1),
  },
});
