import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { font, radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import type { IconName } from './controls';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'destructive' | 'info' | 'insight' | 'ink';

/*
 * Badge — a status pill. Tones map onto the brand meanings:
 * success = sage (taken), accent = the palette pastel (due / now),
 * warning = butter (supply, skipped), destructive = rose (missed),
 * info = sky (schedule), insight = lilac. Pair with an icon so state is
 * never carried by colour alone.
 */
export const Badge = ({
  label,
  tone = 'neutral',
  icon,
  size = 'md',
}: {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  size?: 'md' | 'sm';
}) => {
  const { c } = useTokens();
  const map: Record<BadgeTone, { bg: string; fg: string; border?: string }> = {
    neutral: { bg: 'transparent', fg: c.textSecondary, border: c.separator },
    accent: { bg: c.accentSoft, fg: c.onAccentSoft },
    success: { bg: c.tones.sage.bg, fg: c.tones.sage.fg },
    warning: { bg: c.tones.butter.bg, fg: c.tones.butter.fg },
    destructive: { bg: c.tones.rose.bg, fg: c.tones.rose.fg },
    info: { bg: c.tones.sky.bg, fg: c.tones.sky.fg },
    insight: { bg: c.tones.lilac.bg, fg: c.tones.lilac.fg },
    ink: { bg: c.ink, fg: c.onInk },
  };
  const t = map[tone];
  const height = size === 'sm' ? 26 : 30;

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing(1),
        minHeight: height,
        borderRadius: radius.full,
        backgroundColor: t.bg,
        borderWidth: t.border ? 1.5 : 0,
        borderColor: t.border,
        paddingLeft: icon ? spacing(2.5) : spacing(3),
        paddingRight: spacing(3),
      }}
    >
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 14 : 16} color={t.fg} /> : null}
      <Text
        numberOfLines={1}
        style={[
          size === 'sm' ? typography.caption : typography.subhead,
          { color: t.fg, fontFamily: font.bold, fontSize: size === 'sm' ? 13 : 14 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};
