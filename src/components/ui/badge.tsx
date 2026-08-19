import { Text, View } from 'react-native';
import { radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'destructive';

const toneStyle = (
  tone: BadgeTone,
  colors: ReturnType<typeof useTokens>['c'],
): { bg: string; fg: string } => {
  if (tone === 'accent') return { bg: `${colors.accent}1A`, fg: colors.accent };
  if (tone === 'success') return { bg: `${colors.success}1A`, fg: colors.success };
  if (tone === 'warning') return { bg: `${colors.warning}22`, fg: colors.warning };
  if (tone === 'destructive') return { bg: `${colors.destructive}1A`, fg: colors.destructive };
  return { bg: colors.surfaceRaised, fg: colors.textSecondary };
};

export const Badge = ({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: BadgeTone;
}) => {
  const { c } = useTokens();
  const toneColors = toneStyle(tone, c);

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        minHeight: 24,
        borderRadius: radius.full,
        backgroundColor: toneColors.bg,
        justifyContent: 'center',
        paddingHorizontal: spacing(2),
      }}
    >
      <Text
        style={[
          typography.caption,
          {
            color: toneColors.fg,
            fontWeight: '600',
            letterSpacing: 0.2,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};
