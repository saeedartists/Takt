import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

export default function RegisterWebScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();

  return (
    <PageShell>
      <PageHeader title={t('authRegisterTitle')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.body, { color: c.textPrimary }]}>{t('authRegisterDescription')}</Text>
            <Text style={[typography.footnote, { color: c.textSecondary }]}>Use mobile build for full Ovok native auth widgets.</Text>
            <Button label={t('acceptConsent')} onPress={() => router.replace('/consent' as never)} />
            <Button label={t('authSignInTitle')} kind="secondary" onPress={() => router.replace('/auth/sign-in' as never)} />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
