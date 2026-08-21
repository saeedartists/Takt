import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import {
  Button,
  Card,
  PageHeader,
  PageShell,
  SectionHeader,
  Stack,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import { env } from '@/lib/env';
import { useLocale } from '@/lib/takt/l10n';

export default function SetupScreen() {
  const { c } = useTokens();
  const router = useRouter();
  const { t } = useLocale();

  return (
    <PageShell>
      <PageHeader title={t('setupTitle')} subtitle={t('setupSubtitle')} />
      <Stack>
        <View>
          <SectionHeader title={t('setupRequiredValues')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(2) }}>
              <Text style={[typography.body, { color: c.textPrimary }]}>{t('setupInstruction')}</Text>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>• EXPO_PUBLIC_OVOK_API_URL</Text>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>• EXPO_PUBLIC_OVOK_TENANT_CODE</Text>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('setupCurrentApiUrl')}: {env.ovokApiUrl}</Text>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('setupCurrentTenantCode')}: {env.ovokTenantCode || t('setupMissingValue')}</Text>
            </View>
          </Card>
        </View>

        {env.ovokTenantCode ? <Button label={t('setupOpenSignIn')} onPress={() => router.replace('/auth/sign-in' as never)} /> : null}
      </Stack>
    </PageShell>
  );
}
