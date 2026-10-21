import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LoginResponse } from '@ovok/core';
import { Button, Field, Input, PageShell, spacing } from '@/components/ui';
import { env } from '@/lib/env';
import { ovokClient } from '@/lib/ovok-client';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { mapAuthError } from '@/lib/takt/auth-errors';
import { useLocale } from '@/lib/takt/l10n';
import { AuthBanner, AuthBlock, AuthHero, AuthLinkRow, PasswordInput } from './auth-shared';

type MfaStep = Extract<LoginResponse, { nextStep: 'mfa' }>;

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  // MFA continuation per Ovok docs: login() can resolve with a pending step;
  // verification completes the SAME attempt and yields the tokens.
  const [mfaPending, setMfaPending] = useState<MfaStep | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // Derived so errors clear as the user types; shown only after a submit attempt.
  const emailError = submitted && !email.trim() ? t('authEmailRequired') : null;
  const passwordError = submitted && !password ? t('authPasswordRequired') : null;

  const completeSignIn = async (authenticated: Extract<LoginResponse, { accessToken: string }>) => {
    await ovokClient.setActiveLogin({
      accessToken: authenticated.accessToken,
      refreshToken: authenticated.refreshToken,
      project:
        typeof authenticated.project.reference === 'string'
          ? { reference: authenticated.project.reference, display: authenticated.project.display }
          : authenticated.project.reference,
      profile:
        typeof authenticated.profile.reference === 'string'
          ? { reference: authenticated.profile.reference, display: authenticated.profile.display }
          : authenticated.profile.reference,
    });

    const consent = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
    router.replace(consent === 'accepted' ? '/(tabs)/today' : '/consent');
  };

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

      if ('nextStep' in response) {
        setMfaPending(response);
        return;
      }

      await completeSignIn(response);
    } catch (error) {
      setErrorText(mapAuthError('sign-in', error, t));
    } finally {
      setBusy(false);
    }
  };

  const verifyMfa = async () => {
    if (!mfaPending || !mfaCode.trim()) return;
    setBusy(true);
    try {
      const authenticated = await mfaPending.verify(mfaCode.trim());
      setMfaPending(null);
      await completeSignIn(authenticated);
    } catch (error) {
      setErrorText(mapAuthError('sign-in', error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <View style={styles.page}>
        <AuthHero title={t('authWelcomeBack')} description={t('authSignInDescription')} />

        {mfaPending ? (
          <AuthBlock index={2}>
            <Field label={t('authMfaCodeLabel')} hint={t('authMfaHint')}>
              <Input
                value={mfaCode}
                onChangeText={(next) =>
                  setMfaCode(next.replace(/[^\d]/g, '').slice(0, 6))
                }
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                placeholder={t('authMfaCodePlaceholder')}
                onSubmitEditing={() => void verifyMfa()}
              />
            </Field>
            {errorText ? <AuthBanner tone="destructive" message={errorText} /> : null}
          </AuthBlock>
        ) : (
          <AuthBlock index={2}>
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

            <View>
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
              <AuthLinkRow
                align="flex-end"
                label={`${t('authForgotPasswordCta')}?`}
                onPress={() => router.push('/auth/reset-password' as never)}
              />
            </View>

            {errorText ? <AuthBanner tone="destructive" message={errorText} /> : null}
          </AuthBlock>
        )}

        <AuthBlock index={4}>
          <View style={styles.actions}>
            {mfaPending ? (
              <>
                <Button
                  size="lg"
                  accentIcon="arrow-forward"
                  label={t('authMfaVerify')}
                  loading={busy}
                  onPress={() => void verifyMfa()}
                />
                <Button
                  kind="outline"
                  label={t('authBackToSignIn')}
                  disabled={busy}
                  onPress={() => {
                    setMfaCode('');
                    setMfaPending(null);
                  }}
                />
              </>
            ) : (
              <>
                <Button size="lg" accentIcon="arrow-forward" label={t('authSignInTitle')} loading={busy} onPress={() => void submit()} />
                <Button kind="outline" label={t('authCreateAccountCta')} onPress={() => router.push('/auth/register' as never)} />
              </>
            )}
          </View>
        </AuthBlock>
      </View>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing(6) },
  actions: { gap: spacing(3) },
});
