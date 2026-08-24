import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

export default function ResetPasswordWebScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();

  return (
    <PageShell>
      <PageHeader title={t('authResetPasswordTitle')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.body, { color: c.textPrimary }]}>{t('authResetDescription')}</Text>
            <Text style={[typography.footnote, { color: c.textSecondary }]}>Reset is available in the mobile app experience.</Text>
            <Button label={t('authSignInTitle')} onPress={() => router.replace('/auth/sign-in' as never)} />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
