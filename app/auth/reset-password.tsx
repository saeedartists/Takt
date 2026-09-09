import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();

  return (
    <PageShell>
      <PageHeader title={t('authResetPasswordTitle')} />
      <Stack>
        <Text style={{ ...typography.body, textAlign: 'center', marginTop: spacing(6) }}>
          Reset password screen loading...
        </Text>
        <Text style={{ ...typography.caption, textAlign: 'center', marginTop: spacing(2) }}>
          This is a fallback screen. Please check your platform-specific files.
        </Text>
        <Button 
          label={t('authSignInTitle')} 
          kind="secondary" 
          onPress={() => router.replace('/auth/sign-in' as never)} 
        />
      </Stack>
    </PageShell>
  );
}
