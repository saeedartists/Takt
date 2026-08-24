import AsyncStorage from '@react-native-async-storage/async-storage';
import { SignIn } from '@ovok/native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { env } from '@/lib/env';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';

export default function SignInNativeScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuthSuccess = async () => {
    const consent = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
    if (consent === 'accepted') {
      router.replace('/(tabs)/today');
      return;
    }

    router.replace('/consent');
  };

  if (!env.ovokTenantCode) {
    return (
      <PageShell>
        <PageHeader title={t('authSignInTitle')} />
        <Stack>
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <Text style={[typography.body, { color: c.textPrimary }]}>{t('authBackendNotReadyTitle')}</Text>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('authBackendNotReadyBody')}</Text>
              <Button label={t('setupTitle')} onPress={() => router.replace('/setup' as never)} />
            </View>
          </Card>
        </Stack>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title={t('authSignInTitle')} />
      <SignIn contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}>
        <SignIn.Header>
          <SignIn.Header.Title />
          <SignIn.Header.Description />
        </SignIn.Header>

        <SignIn.EmailForm
          loginType="Patient"
          tenantCode={env.ovokTenantCode}
          onSuccess={() => {
            void handleAuthSuccess();
          }}
          onError={() => {
            setAuthError(t('authErrorSignIn'));
          }}
        >
          <SignIn.EmailForm.Inputs />
          <SignIn.EmailForm.ForgotPassword onPress={() => router.push('/auth/reset-password' as never)} />
          <SignIn.EmailForm.Spacing percentage={0.4} />
          <SignIn.EmailForm.SigninButton />
        </SignIn.EmailForm>

        <SignIn.RegisterLink onPress={() => router.push('/auth/register' as never)} />
      </SignIn>

      {authError ? (
        <Stack>
          <Text style={[typography.footnote, { color: c.destructive }]}>{authError}</Text>
        </Stack>
      ) : null}
    </PageShell>
  );
}
