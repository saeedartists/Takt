import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';

/*
 * PageShell / PageHeader / Stack — screen chrome mirroring the web
 * scaffold. Health uses a large left-aligned title with generous top
 * space over a grouped background.
 */

export const PageShell = ({ children }: { children: ReactNode }) => {
  const { c } = useTokens();
  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.content}
    >
      {children}
    </ScrollView>
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
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    paddingBottom: spacing(12),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing(4),
    marginBottom: spacing(5),
  },
  headerText: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: spacing(1) },
  stack: { gap: spacing(6) },
});
