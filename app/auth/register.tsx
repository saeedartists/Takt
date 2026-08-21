import AsyncStorage from '@react-native-async-storage/async-storage';
import { Register } from '@ovok/native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { env } from '@/lib/env';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { isBackendAuthNotReady } from '@/lib/takt/auth-errors';

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <Register>
      <Register.Header>
        <Register.Header.Title>{t('authRegisterHeaderTitle')}</Register.Header.Title>
        <Register.Header.Description>{t('authRegisterDescription')}</Register.Header.Description>
      </Register.Header>

      <Register.EmailForm
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
        onError={(error) =>
          Alert.alert(
            isBackendAuthNotReady(error.message) ? t('authBackendNotReadyTitle') : (t('authErrorRegister')),
            isBackendAuthNotReady(error.message) ? t('authBackendNotReadyBody') : error.message,
          )
        }
      >
        <Register.EmailForm.Inputs />
        <Register.EmailForm.RegisterButton />
      </Register.EmailForm>

      <Register.LoginLink onPress={() => router.replace('/auth/sign-in' as never)} />
    </Register>
  );
}
