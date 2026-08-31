import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Field, Input, PageHeader, PageShell, SegmentedControl, Stack, spacing, typography, useTokens } from '@/components/ui';
import { env } from '@/lib/env';
import { ovokClient } from '@/lib/ovok-client';
import { mapAuthError } from '@/lib/takt/auth-errors';
import { useLocale } from '@/lib/takt/l10n';

type ResetType = 'Patient' | 'Practitioner';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();

  const [email, setEmail] = useState('');
  const [resetType, setResetType] = useState<ResetType>('Patient');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErrorText(null);
    setSent(false);

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
      <PageHeader title={t('authResetHeaderTitle')} subtitle={t('authResetDescription')} />
      <Stack>
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
            {sent ? <Text style={[typography.footnote, { color: c.success }]}>{t('authResetEmailSentBody')}</Text> : null}
            {errorText ? <Text style={[typography.footnote, { color: c.destructive }]}>{errorText}</Text> : null}
            <Button label={busy ? t('authSendingReset') : t('authResetPasswordTitle')} disabled={busy} onPress={() => void submit()} />
          </View>
        </Card>

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Button kind="secondary" label={t('authBackToSignIn')} onPress={() => router.push('/auth/sign-in' as never)} />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
