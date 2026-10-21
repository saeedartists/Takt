import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, INK, PageShell, spacing, typography, useTokens } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';
import { resolveSessionGate } from '@/lib/auth-session';

/*
 * Live builds see this when the Ovok service cannot be reached at launch —
 * different from /setup (nothing configured): the configuration exists, the
 * service is just unreachable. Real users get a calm retry, not diagnostics.
 */
export default function BackendDownScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { c } = useTokens();
  const [checking, setChecking] = useState(false);

  const retry = async () => {
    setChecking(true);
    const gate = await resolveSessionGate();
    setChecking(false);

    if (gate.kind === 'authenticated') {
      router.replace('/(tabs)/today');
      return;
    }
    if (gate.kind === 'unauthenticated') {
      router.replace('/auth/sign-in');
      return;
    }
    if (gate.kind === 'needs-config') {
      router.replace('/setup');
      return;
    }
    // Still down (or still mock): stay here; the copy explains itself.
  };

  return (
    <PageShell>
      <View style={styles.page}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.hero}>
          <View style={[styles.iconWrap, { backgroundColor: c.tones.butter.bg }]}>
            <Ionicons name="cloud-offline-outline" size={30} color={INK} />
          </View>
          <Text accessibilityRole="header" style={[typography.title1, { color: c.textPrimary }]}>
            {t('backendDownTitle')}
          </Text>
          <Text style={[typography.body, { color: c.textSecondary, textAlign: 'center' }]}>
            {t('backendDownBody')}
          </Text>
        </Animated.View>

        <Card>
          <Text style={[typography.footnote, { color: c.textSecondary }]}>
            {t('backendDownHintsIntro')}
          </Text>
          <Text style={[typography.footnote, { color: c.textSecondary }]}>1. {t('backendDownHintConnectivity')}</Text>
          <Text style={[typography.footnote, { color: c.textSecondary }]}>2. {t('backendDownHintLater')}</Text>
        </Card>

        <View style={styles.actions}>
          <Button
            size="lg"
            accentIcon="arrow-forward"
            label={t('backendDownRetry')}
            loading={checking}
            onPress={() => void retry()}
          />
          <Button kind="ghost" label={t('backendDownDetails')} onPress={() => router.push('/setup')} />
        </View>
      </View>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing(5), alignItems: 'center' },
  hero: { alignItems: 'center', gap: spacing(3), marginTop: spacing(8), paddingHorizontal: spacing(2) },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  actions: { width: '100%', gap: spacing(1) },
});
