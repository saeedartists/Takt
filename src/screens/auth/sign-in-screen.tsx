import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Field, Input, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { env } from '@/lib/env';
import { ovokClient } from '@/lib/ovok-client';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { mapAuthError } from '@/lib/takt/auth-errors';
import { useLocale } from '@/lib/takt/l10n';

export default function SignInScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const submit = async () => {
    setErrorText(null);

    if (!env.ovokTenantCode) {
      setErrorText(t('authTenantMissing'));
      router.replace('/setup' as never);
      return;
    }

    setBusy(true);
    try {
      const response = await ovokClient.login({
        email: email.trim().toLowerCase(),
        password,
        type: 'Patient',
        tenantCode: env.ovokTenantCode,
      });

      await ovokClient.setActiveLogin({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        project: typeof response.project.reference === 'string'
          ? { reference: response.project.reference, display: response.project.display }
          : response.project.reference,
        profile: typeof response.profile.reference === 'string'
          ? { reference: response.profile.reference, display: response.profile.display }
          : response.profile.reference,
      });

      const consent = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
      router.replace(consent === 'accepted' ? '/(tabs)/today' : '/consent');
    } catch (error) {
      setErrorText(mapAuthError('sign-in', error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <PageHeader title={t('authSignInTitle')} subtitle={t('authSignInDescription')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Field label={t('authEmailLabel')}>
              <Input
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                placeholder={t('authEmailPlaceholder')}
              />
            </Field>
            <Field label={t('authPasswordLabel')}>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                autoComplete="password"
                placeholder={t('authPasswordPlaceholder')}
              />
            </Field>
            {errorText ? <Text style={[typography.footnote, { color: c.destructive }]}>{errorText}</Text> : null}
            <Button label={busy ? t('authSigningIn') : t('authSignInTitle')} disabled={busy} onPress={() => void submit()} />
          </View>
        </Card>

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Button kind="secondary" label={t('authCreateAccountCta')} onPress={() => router.push('/auth/register' as never)} />
            <Button kind="secondary" label={t('authForgotPasswordCta')} onPress={() => router.push('/auth/reset-password' as never)} />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
