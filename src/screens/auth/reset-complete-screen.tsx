import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Input, PageShell, spacing } from '@/components/ui';
import { ovokClient } from '@/lib/ovok-client';
import { mapAuthError } from '@/lib/takt/auth-errors';
import { useLocale } from '@/lib/takt/l10n';
import { AuthBanner, AuthBlock, AuthHero, AuthLinkRow } from './auth-shared';

/*
 * The second half of a password reset. Ovok emails a link carrying `id` and
 * `secret`; with the takt scheme pointed there this screen opens directly in
 * the app, hands the tokens to the server with the new password, and sends the
 * user back to sign-in.
 */
export default function ResetCompleteScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const params = useLocalSearchParams<{ id?: string; secret?: string }>();

  const id = typeof params.id === 'string' ? params.id : '';
  const secret = typeof params.secret === 'string' ? params.secret : '';
  const linkValid = Boolean(id && secret);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const passwordError =
    submitted && password.length < 8 ? t('authPasswordTooShort') : null;
  const mismatchError = submitted && password.length >= 8 && password !== confirm ? t('authPasswordMismatch') : null;

  const submit = async () => {
    setSubmitted(true);
    setErrorText(null);
    if (!linkValid || password.length < 8 || password !== confirm) return;

    setBusy(true);
    try {
      await ovokClient.setPasswordFromReset({ id, secret, password });
      setDone(true);
    } catch (error) {
      setErrorText(mapAuthError('reset', error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <View style={{ gap: spacing(6) }}>
        <AuthHero
          title={done ? t('authCompleteSuccessTitle') : linkValid ? t('authCompleteTitle') : t('authCompleteLinkInvalidTitle')}
          description={
            done
              ? t('authCompleteSuccessBody')
              : linkValid
                ? t('authCompleteDescription')
                : t('authCompleteLinkInvalidBody')
          }
        />

        {done ? (
          <AuthBlock index={4}>
            <Button
              size="lg"
              accentIcon="arrow-forward"
              label={t('authSignInTitle')}
              onPress={() => router.replace('/auth/sign-in' as never)}
            />
          </AuthBlock>
        ) : linkValid ? (
          <>
            <AuthBlock index={2}>
              <Field label={t('authPasswordLabel')} error={passwordError}>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  invalid={Boolean(passwordError)}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  placeholder={t('authPasswordPlaceholder')}
                  onSubmitEditing={() => void submit()}
                />
              </Field>
              <Field label={t('authPasswordConfirmLabel')} error={mismatchError}>
                <Input
                  value={confirm}
                  onChangeText={setConfirm}
                  invalid={Boolean(mismatchError)}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  placeholder={t('authPasswordConfirmPlaceholder')}
                  onSubmitEditing={() => void submit()}
                />
              </Field>
            </AuthBlock>

            <AuthBlock index={4}>
              <Button size="lg" accentIcon="arrow-forward" label={t('authCompleteCta')} loading={busy} onPress={() => void submit()} />
              <AuthLinkRow label={t('authBackToSignIn')} onPress={() => router.push('/auth/sign-in' as never)} />
            </AuthBlock>
          </>
        ) : (
          <AuthBlock index={4}>
            <Button
              size="lg"
              accentIcon="arrow-forward"
              label={t('authBackToSignIn')}
              onPress={() => router.replace('/auth/sign-in' as never)}
            />
          </AuthBlock>
        )}

        {errorText ? <AuthBanner tone="destructive" message={errorText} /> : null}
      </View>
    </PageShell>
  );
}
