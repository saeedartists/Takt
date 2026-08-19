import { Text, View } from 'react-native';
import { Badge, Card, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

export default function ImprintScreen() {
  const { c } = useTokens();
  const { t } = useLocale();

  return (
    <PageShell>
      <PageHeader title={t('imprint')} subtitle={t('legal')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(2.5) }}>
            <Text style={[typography.title3, { color: c.textPrimary }]}>{t('imprintCompany')}</Text>
            <Text style={[typography.body, { color: c.textPrimary }]}>{t('imprintDepartment')}</Text>
            <Text style={[typography.body, { color: c.textPrimary }]}>{t('imprintCity')}</Text>
            <Text style={[typography.body, { color: c.textPrimary }]}>{t('imprintEmail')}</Text>
            <Badge label={t('imprintDraftNotice')} tone="neutral" />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
