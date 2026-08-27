import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';

export default function SignInNativeScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();

  const handleContinue = async () => {
    const consent = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
    if (consent === 'accepted') {
      router.replace('/(tabs)/today');
      return;
    }

    router.replace('/consent');
  };

  return (
    <PageShell>
      <PageHeader title={t('authSignInTitle')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.body, { color: c.textPrimary }]}>{t('authBackendNotReadyTitle')}</Text>
            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('authBackendNotReadyBody')}</Text>
            <Button label={t('setupTitle')} onPress={() => void handleContinue()} />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
