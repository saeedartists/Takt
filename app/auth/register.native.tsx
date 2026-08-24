import AsyncStorage from '@react-native-async-storage/async-storage';
import { Register } from '@ovok/native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { env } from '@/lib/env';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';

export default function RegisterNativeScreen() {
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
        <PageHeader title={t('authRegisterTitle')} />
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
      <PageHeader title={t('authRegisterTitle')} />
      <Register contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}>
        <Register.Header>
          <Register.Header.Title />
          <Register.Header.Description />
        </Register.Header>

        <Register.EmailForm
          tenantCode={env.ovokTenantCode}
          onSuccess={() => {
            void handleAuthSuccess();
          }}
          onError={() => {
            setAuthError(t('authErrorRegister'));
          }}
        >
          <Register.EmailForm.Inputs />
          <Register.EmailForm.Spacing percentage={0.4} />
          <Register.EmailForm.RegisterButton />
        </Register.EmailForm>

        <Register.LoginLink onPress={() => router.replace('/auth/sign-in' as never)} />
      </Register>

      {authError ? (
        <Stack>
          <Text style={[typography.footnote, { color: c.destructive }]}>{authError}</Text>
        </Stack>
      ) : null}
    </PageShell>
  );
}
