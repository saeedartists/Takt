import { useSegments } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

/*
 * PageShell / PageHeader / Stack — screen chrome mirroring the web
 * scaffold. Health uses a large left-aligned title with generous top
 * space over a grouped background.
 */

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
      <ScrollView
        style={{ backgroundColor: c.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        {children}
      </ScrollView>
    </View>
  );
};

export const PageHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) => {
  const { c } = useTokens();
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={[typography.largeTitle, { color: c.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[typography.subhead, styles.subtitle, { color: c.textSecondary }]}>
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
    paddingTop: spacing(4),
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(12),
    // Reading column on wide viewports; a no-op on phones.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing(4),
    marginBottom: spacing(4),
  },
  headerText: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: spacing(1) },
  stack: { gap: spacing(5) },
});
