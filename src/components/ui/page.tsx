import { useSegments } from 'expo-router';
import type { ComponentType, ReactNode } from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

/*
 * PageShell / PageHeader / Stack — screen chrome mirroring the web
 * scaffold. Health uses a large left-aligned title with generous top
 * space over a grouped background.
 */

/*
 * Native: the focused input scrolls clear of the keyboard and of a
 * KeyboardStickyView footer (bottomOffset). Web has no soft keyboard.
 */
const Scroll = (Platform.OS === 'web' ? ScrollView : KeyboardAwareScrollView) as ComponentType<
  ScrollViewProps & { bottomOffset?: number }
>;

const fallbackStatusBarTop = (): number =>
  Platform.OS === 'ios' ? 59 : StatusBar.currentHeight ?? 24;

export const PageShell = ({ children }: { children: ReactNode }) => {
  const { c } = useTokens();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  /*
   * usePathname() strips route groups, so `/today` never starts with
   * `/(tabs)`. v0.1.1 used that check and skipped the inset on every
   * tab screen — titles sat under the status bar. useSegments() keeps
   * `(tabs)`.
   */
  const isHeaderless = segments[0] === '(tabs)';
  const statusBarTop = insets.top > 0 ? insets.top : fallbackStatusBarTop();
  const topInset = isHeaderless ? statusBarTop : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: topInset }}>
      <Scroll
        style={{ backgroundColor: c.background }}
        contentContainerStyle={[styles.content, isHeaderless && styles.contentTabs]}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={96}
        showsVerticalScrollIndicator={false}
      >
        {/* One soft fade for the whole page; sections add their own staggered rise. */}
        <Animated.View entering={FadeIn.duration(260)}>{children}</Animated.View>
      </Scroll>
    </View>
  );
};

export const PageHeader = ({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  /** Omit on stack screens: the native header already shows the title, so only the lead line renders. */
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  /** Small line above the title, e.g. a greeting or date. */
  eyebrow?: string;
}) => {
  const { c } = useTokens();
  return (
    <View style={[styles.header, { alignItems: title ? 'flex-end' : 'flex-start' }]}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={[typography.subhead, styles.eyebrow, { color: c.textSecondary }]}>{eyebrow}</Text> : null}
        {title ? (
          <Text accessibilityRole="header" style={[typography.display, { color: c.textPrimary }]}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[title ? typography.subhead : typography.body, title ? styles.subtitle : null, { color: c.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
};

export const Stack = ({ children }: { children: ReactNode }) => (
  <View style={styles.stack}>{children}</View>
);

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing(3),
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(14),
    // Reading column on wide viewports; a no-op on phones.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  // The docked tab bar sits below the scroll view; just leave breathing room.
  contentTabs: { paddingTop: spacing(3), paddingBottom: spacing(8) },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(4),
    marginBottom: spacing(4),
  },
  headerText: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: spacing(1.5) },
  eyebrow: { marginBottom: spacing(1) },
  stack: { gap: spacing(5) },
});
