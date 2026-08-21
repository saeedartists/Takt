import AsyncStorage from '@react-native-async-storage/async-storage';
import { SignIn } from '@ovok/native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { env } from '@/lib/env';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <SignIn>
      <SignIn.Header>
        <SignIn.Header.Title>Takt</SignIn.Header.Title>
        <SignIn.Header.Description>{t('authSignInDescription')}</SignIn.Header.Description>
      </SignIn.Header>

      <SignIn.EmailForm
        loginType="Patient"
        tenantCode={env.ovokTenantCode}
        onSuccess={() => {
          void AsyncStorage.getItem(CONSENT_STORAGE_KEY).then((consent) => {
            if (consent === 'accepted') {
              router.replace('/(tabs)/today');
            } else {
              router.replace('/consent');
            }
          });
        }}
        onError={(error) => Alert.alert(t('authErrorSignIn'), error.message)}
      >
        <SignIn.EmailForm.Inputs />
        <SignIn.EmailForm.ForgotPassword onPress={() => router.push('/auth/reset-password' as never)} />
        <SignIn.EmailForm.SigninButton />
      </SignIn.EmailForm>

      <SignIn.RegisterLink onPress={() => router.push('/auth/register' as never)} />
    </SignIn>
  );
}
