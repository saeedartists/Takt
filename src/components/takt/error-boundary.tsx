import * as Updates from 'expo-updates';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { captureError } from '../../lib/takt/error-reporting';
import { useLocale } from '../../lib/takt/l10n';
import { radius, spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import { Button } from '../ui/controls';

type BoundaryProps = {
  children: ReactNode;
  /**
   * Replace the default fallback. Receives a retry callback; must not
   * depend on any provider, because boundaries render outside the tree
   * that crashed — and the outermost one has no providers above it.
   */
  fallbackRender?: (retry: () => void) => ReactNode;
};

type BoundaryState = {
  error: Error | null;
};

const BrokenGlyph = () => {
  const { c } = useTokens();
  return (
    <View
      style={[styles.glyph, { backgroundColor: c.tones.rose.bg }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[typography.title1, { color: c.tones.rose.solid }]}>!</Text>
    </View>
  );
};

const CrashFallback = ({ onRetry }: { onRetry: () => void }) => {
  const { c } = useTokens();
  const { t } = useLocale();
  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BrokenGlyph />
        <Text style={[typography.title1, styles.title, { color: c.textPrimary }]}>
          {t('crashTitle')}
        </Text>
        <Text style={[typography.body, styles.hint, { color: c.textSecondary }]}>
          {t('crashHint')}
        </Text>
        <View style={styles.button}>
          <Button label={t('crashReload')} onPress={onRetry} kind="primary" />
        </View>
        <Text style={[typography.footnote, { color: c.textSecondary }]}>
          {t('crashRestartHint')}
        </Text>
      </ScrollView>
    </View>
  );
};

/** Zero-provider fallback for the outermost boundary: plain system type. */
const StaticFallback = ({ onRetry }: { onRetry: () => void }) => (
  <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.glyph, styles.glyphStatic]}>
        <Text style={styles.glyphMark}>!</Text>
      </View>
      <Text style={[typography.title1, styles.title]}>Something went wrong.</Text>
      <Text style={[typography.body, styles.hint]}>
        Please restart the app.
      </Text>
      <View style={styles.button}>
        <Button label="Try again" onPress={onRetry} kind="primary" />
      </View>
    </ScrollView>
  </View>
);

const reloadApp = (): void => {
  void Updates.reloadAsync().catch(() => undefined);
};

/**
 * Crash net for a subtree. A render error swaps the tree for a recovery
 * screen instead of a white flash; the error goes through `captureError`
 * so a reporting backend sees every crash. Use two layers at the root:
 * a static outer one (works without providers) and the themed default
 * inside ThemeProvider/LocaleProvider.
 */
export class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError('boundary', error, info.componentStack ?? undefined);
  }

  private retry = (): void => {
    this.setState({ error: null });
    // In embedded-update builds an Expo update reload is the closest thing
    // to a clean restart; on dev/dev-client builds it reloads the bundle.
    reloadApp();
  };

  render(): ReactNode {
    if (this.state.error) {
      const fallbackRender = this.props.fallbackRender ?? ((retry) => <StaticFallback onRetry={retry} />);
      return fallbackRender(this.retry);
    }
    return this.props.children;
  }
}

export const ThemedCrashFallback = CrashFallback;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(6),
    gap: spacing(2),
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  glyph: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2),
  },
  glyphStatic: {
    backgroundColor: '#F6E2E0',
  },
  glyphMark: {
    ...typography.title1,
    color: '#B64B43',
  },
  title: {
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
    marginBottom: spacing(3),
  },
  button: {
    width: '100%',
    marginBottom: spacing(3),
  },
});
