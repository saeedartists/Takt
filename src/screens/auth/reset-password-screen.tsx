import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, Input, PageShell, SegmentedControl, Stack, spacing } from '@/components/ui';
import { env } from '@/lib/env';
import { ovokClient } from '@/lib/ovok-client';
import { mapAuthError } from '@/lib/takt/auth-errors';
import { useLocale } from '@/lib/takt/l10n';
import { AuthBanner, AuthHero, AuthLinkRow } from './auth-shared';

type ResetType = 'Patient' | 'Practitioner';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useLocale();

  const [email, setEmail] = useState('');
  const [resetType, setResetType] = useState<ResetType>('Patient');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailError = submitted && !email.trim() ? t('authEmailRequired') : null;

  const submit = async () => {
    setSubmitted(true);
    setErrorText(null);
    setSent(false);
    if (!email.trim()) return;

    setBusy(true);
    try {
      const clientId =
        resetType === 'Patient'
          ? env.ovokClientId || env.googleSocialLoginClientId || undefined
          : undefined;

      await ovokClient.resetPassword({
        email: email.trim().toLowerCase(),
        type: resetType,
        clientId,
      });

      setSent(true);
    } catch (error) {
      setErrorText(mapAuthError('reset', error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <Stack>
        <AuthHero icon="key" title={t('authResetHeaderTitle')} description={t('authResetDescription')} />

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Field label={t('authResetTypeLabel')}>
              <SegmentedControl
                value={resetType}
                onChange={(next) => setResetType(next as ResetType)}
                options={[
                  { value: 'Patient', label: t('authResetTypePatient') },
                  { value: 'Practitioner', label: t('authResetTypePractitioner') },
                ]}
              />
            </Field>
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
                onSubmitEditing={() => void submit()}
              />
            </Field>
            {sent ? <AuthBanner tone="success" message={t('authResetEmailSentBody')} /> : null}
            {errorText ? <AuthBanner tone="destructive" message={errorText} /> : null}
            <Button label={t('authResetPasswordTitle')} loading={busy} onPress={() => void submit()} />
          </View>
        </Card>

        <AuthLinkRow label={t('authBackToSignIn')} onPress={() => router.push('/auth/sign-in' as never)} />
      </Stack>
    </PageShell>
  );
}
