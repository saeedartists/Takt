import { ResetPassword } from '@ovok/native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Button, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

export default function ResetPasswordNativeScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  return (
    <PageShell>
      <PageHeader title={t('authResetPasswordTitle')} />
      <ResetPassword contentContainerStyle={{ padding: spacing(4), gap: spacing(3), flexGrow: 1 }}>
        <ResetPassword.Header>
          <ResetPassword.Header.Title />
          <ResetPassword.Header.Description />
        </ResetPassword.Header>

        <ResetPassword.Form
          onSuccess={() => {
            setStatusMessage(t('authResetEmailSentBody'));
          }}
          onError={() => {
            setStatusMessage(t('authErrorReset'));
          }}
        >
          <ResetPassword.Form.Inputs />
          <ResetPassword.Form.Spacing percentage={0.5} />
          <ResetPassword.Form.Button />
        </ResetPassword.Form>
      </ResetPassword>

      <Stack>
        {statusMessage ? (
          <Text
            style={[
              typography.footnote,
              {
                color: statusMessage === t('authErrorReset') ? c.destructive : c.textSecondary,
              },
            ]}
          >
            {statusMessage}
          </Text>
        ) : null}

        <Button kind="secondary" label={t('authSignInTitle')} onPress={() => router.replace('/auth/sign-in' as never)} />
      </Stack>
    </PageShell>
  );
}
