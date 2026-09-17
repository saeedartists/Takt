import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, Input, PageShell, Stack, spacing } from '@/components/ui';
import { env } from '@/lib/env';
import { ovokClient } from '@/lib/ovok-client';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { mapAuthError } from '@/lib/takt/auth-errors';
import { useLocale } from '@/lib/takt/l10n';
import { AuthBanner, AuthHero, AuthLinkRow, PasswordInput } from './auth-shared';

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Derived so errors clear as the user types; shown only after a submit attempt.
  const emailError = submitted && !email.trim() ? t('authEmailRequired') : null;
  const passwordError = submitted && !password ? t('authPasswordRequired') : null;

  const submit = async () => {
    setErrorText(null);
    setSubmitted(true);
    if (!email.trim() || !password) return;

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
        project:
          typeof response.project.reference === 'string'
            ? { reference: response.project.reference, display: response.project.display }
            : response.project.reference,
        profile:
          typeof response.profile.reference === 'string'
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
      <Stack>
        <AuthHero icon="medkit" title={t('appName')} description={t('authSignInDescription')} />

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3.5) }}>
            <Field label={t('authEmailLabel')} error={emailError}>
              <Input
                value={email}
                onChangeText={setEmail}
                invalid={Boolean(emailError)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                placeholder={t('authEmailPlaceholder')}
              />
            </Field>

            <Field label={t('authPasswordLabel')} error={passwordError}>
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                invalid={Boolean(passwordError)}
                textContentType="password"
                autoComplete="password"
                placeholder={t('authPasswordPlaceholder')}
                onSubmitEditing={() => void submit()}
              />
            </Field>

            <View style={{ alignItems: 'flex-end' }}>
              <AuthLinkRow
                label={`${t('authForgotPasswordCta')}?`}
                onPress={() => router.push('/auth/reset-password' as never)}
              />
            </View>

            {errorText ? <AuthBanner tone="destructive" message={errorText} /> : null}

            <Button label={t('authSignInTitle')} loading={busy} onPress={() => void submit()} />
          </View>
        </Card>

        <AuthLinkRow
          prompt={t('authNoAccountYet')}
          label={t('authCreateAccountCta')}
          onPress={() => router.push('/auth/register' as never)}
        />
      </Stack>
    </PageShell>
  );
}
