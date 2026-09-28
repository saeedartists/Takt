import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Input, PageShell, spacing } from '@/components/ui';
import { env } from '@/lib/env';
import { ovokClient } from '@/lib/ovok-client';
import { mapAuthError } from '@/lib/takt/auth-errors';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { AuthBanner, AuthBlock, AuthHero, AuthLinkRow, PasswordInput } from './auth-shared';

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useLocale();

  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Derived so errors clear as the user types; shown only after a submit attempt.
  const errors = {
    name: submitted && !name.trim() ? t('authFieldRequired') : null,
    surname: submitted && !surname.trim() ? t('authFieldRequired') : null,
    email: submitted && !email.trim() ? t('authEmailRequired') : null,
    password: submitted && !password ? t('authPasswordRequired') : null,
    passwordConfirm:
      submitted && !passwordConfirm
        ? t('authPasswordRequired')
        : submitted && password !== passwordConfirm
          ? t('authPasswordMismatch')
          : null,
  };

  const submit = async () => {
    setErrorText(null);
    setSubmitted(true);
    if (!name.trim() || !surname.trim() || !email.trim() || !password || !passwordConfirm) return;

    if (!env.ovokTenantCode) {
      setErrorText(t('authTenantMissing'));
      router.replace('/setup' as never);
      return;
    }

    if (password !== passwordConfirm) {
      return; // shown inline on the confirm field
    }

    setBusy(true);
    try {
      const response = await ovokClient.register({
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim().toLowerCase(),
        password,
        passwordConfirm,
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
      setErrorText(mapAuthError('register', error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <View style={{ gap: spacing(6) }}>
        <AuthHero title={t('authRegisterHeaderTitle')} description={t('authRegisterDescription')} />

        <AuthBlock index={2}>
          <Field label={t('authGivenNameLabel')} error={errors.name}>
            <Input
              value={name}
              onChangeText={setName}
              invalid={Boolean(errors.name)}
              textContentType="givenName"
              autoComplete="name-given"
              placeholder={t('authGivenNamePlaceholder')}
            />
          </Field>

          <Field label={t('authFamilyNameLabel')} error={errors.surname}>
            <Input
              value={surname}
              onChangeText={setSurname}
              invalid={Boolean(errors.surname)}
              textContentType="familyName"
              autoComplete="name-family"
              placeholder={t('authFamilyNamePlaceholder')}
            />
          </Field>

          <Field label={t('authEmailLabel')} error={errors.email}>
            <Input
              value={email}
              onChangeText={setEmail}
              invalid={Boolean(errors.email)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              placeholder={t('authEmailPlaceholder')}
            />
          </Field>

          <Field label={t('authPasswordLabel')} error={errors.password}>
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              invalid={Boolean(errors.password)}
              textContentType="newPassword"
              autoComplete="password-new"
              placeholder={t('authPasswordPlaceholder')}
            />
          </Field>

          <Field label={t('authPasswordConfirmLabel')} error={errors.passwordConfirm}>
            <PasswordInput
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              invalid={Boolean(errors.passwordConfirm)}
              textContentType="newPassword"
              autoComplete="password-new"
              placeholder={t('authPasswordConfirmPlaceholder')}
              onSubmitEditing={() => void submit()}
            />
          </Field>

          {errorText ? <AuthBanner tone="destructive" message={errorText} /> : null}
        </AuthBlock>

        <AuthBlock index={4}>
          <Button size="lg" accentIcon="arrow-forward" label={t('authRegisterTitle')} loading={busy} onPress={() => void submit()} />
          <AuthLinkRow
            prompt={t('authHaveAccount')}
            label={t('authSignInTitle')}
            onPress={() => router.push('/auth/sign-in' as never)}
          />
        </AuthBlock>
      </View>
    </PageShell>
  );
}
