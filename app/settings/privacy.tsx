import { Text, View } from 'react-native';
import { Badge, Card, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

export default function PrivacyNoticeScreen() {
  const { c } = useTokens();
  const { t } = useLocale();

  return (
    <PageShell>
      <PageHeader title={t('privacyNotice')} subtitle={t('legal')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.headline, { color: c.textPrimary }]}>{t('privacyIntroTitle')}</Text>
            <Text style={[typography.body, { color: c.textPrimary }]}>{t('privacyLine1')}</Text>
            <Text style={[typography.body, { color: c.textPrimary }]}>{t('privacyLine2')}</Text>
            <Text style={[typography.body, { color: c.textPrimary }]}>{t('privacyLine3')}</Text>
            <Text style={[typography.body, { color: c.textPrimary }]}>{t('privacyLine4')}</Text>
            <Badge label={t('privacyLine5')} tone="warning" />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
