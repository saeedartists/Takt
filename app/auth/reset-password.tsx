import { ResetPassword } from '@ovok/native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useLocale } from '@/lib/takt/l10n';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <ResetPassword>
      <ResetPassword.Header>
        <ResetPassword.Header.Title>{t('authResetHeaderTitle')}</ResetPassword.Header.Title>
        <ResetPassword.Header.Description>{t('authResetDescription')}</ResetPassword.Header.Description>
      </ResetPassword.Header>

      <ResetPassword.Form
        onSuccess={() => {
          Alert.alert(t('authResetEmailSentTitle'), t('authResetEmailSentBody'));
          
          router.replace('/auth/sign-in' as never);
        }}
        onError={(error) => Alert.alert(t('authErrorReset'), error.message)}
      >
        <ResetPassword.Form.Inputs />
        <ResetPassword.Form.Button />
      </ResetPassword.Form>
    </ResetPassword>
  );
}
