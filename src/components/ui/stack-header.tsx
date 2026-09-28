import { Ionicons } from '@expo/vector-icons';
import type { NativeStackHeaderProps } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale } from '../../lib/takt/l10n';
import { CONTENT_MAX_WIDTH, MIN_TOUCH_TARGET, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import { AnimatedPressable } from './animated-pressable';

/*
 * StackHeader — the brand top bar for every pushed screen: a round
 * back button, a centred title, and an equal-width spacer so the title
 * stays optically centred. Sits on the paper ground, no hairline.
 */
export function StackHeader({ navigation, options, back }: NativeStackHeaderProps) {
  const { c } = useTokens();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const title = typeof options.title === 'string' ? options.title : '';
  const right = options.headerRight?.({ canGoBack: Boolean(back), tintColor: c.textPrimary });

  return (
    <View style={{ backgroundColor: c.background, paddingTop: Math.max(insets.top, spacing(3)) }}>
      <View style={styles.row}>
        {back ? (
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            haptic="light"
            scaleTo={0.9}
            onPress={() => navigation.goBack()}
            style={[styles.circle, { backgroundColor: c.surface }]}
          >
            <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
          </AnimatedPressable>
        ) : (
          <View style={styles.circle} />
        )}
        <Animated.Text
          key={title}
          entering={FadeIn.duration(220)}
          numberOfLines={1}
          accessibilityRole="header"
          style={[typography.headline, styles.title, { color: c.textPrimary }]}
        >
          {title}
        </Animated.Text>
        <View style={styles.circle}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(2),
    gap: spacing(3),
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH + spacing(10),
    alignSelf: 'center',
  },
  circle: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, textAlign: 'center' },
});
