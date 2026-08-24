import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

export default function SignInWebScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();

  return (
    <PageShell>
      <PageHeader title={t('authSignInTitle')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.body, { color: c.textPrimary }]}>{t('authSignInDescription')}</Text>
            <Text style={[typography.footnote, { color: c.textSecondary }]}>
              Web preview runs a simplified sign-in screen. Continue to test the medication flow.
            </Text>
            <Button label={t('acceptConsent')} onPress={() => router.replace('/consent' as never)} />
            <Button label={t('authRegisterTitle')} kind="secondary" onPress={() => router.push('/auth/register' as never)} />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
