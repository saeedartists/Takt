import { Text, View } from 'react-native';
import { Badge, Card, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

type MessageKey = Parameters<ReturnType<typeof useLocale>['t']>[0];

/* German imprint (§5 TMG / §18 MStV) fields. Values marked "[to be completed]" come from the legal entity. */
const LINES: MessageKey[] = [
  'imprintDepartment',
  'imprintAddress',
  'imprintCity',
  'imprintDirector',
  'imprintRegister',
  'imprintVat',
  'imprintEmail',
  'imprintResponsible',
];

export default function ImprintScreen() {
  const { c } = useTokens();
  const { t } = useLocale();

  return (
    <PageShell>
      <PageHeader title={t('imprint')} subtitle={t('legal')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(2) }}>
            <Text accessibilityRole="header" style={[typography.title3, { color: c.textPrimary }]}>
              {t('imprintCompany')}
            </Text>
            {LINES.map((key) => (
              <Text key={key} style={[typography.body, { color: c.textSecondary }]}>
                {t(key)}
              </Text>
            ))}
            <View style={{ marginTop: spacing(1) }}>
              <Badge label={t('imprintDraftNotice')} tone="neutral" />
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ padding: spacing(4) }}>
            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('safetyNote')}</Text>
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
