import { Text, View } from 'react-native';
import { Card, ListGroup, PageHeader, PageShell, Stack, spacing, typography, useTokens } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

type MessageKey = Parameters<ReturnType<typeof useLocale>['t']>[0];

/*
 * App-specific privacy notice (product brief §8): says exactly what is
 * processed, where, why, on which legal basis, and how to withdraw.
 * Reachable from Settings without an account.
 */
const SECTIONS: { title: MessageKey; body: MessageKey }[] = [
  { title: 'privacyWhoTitle', body: 'privacyWhoBody' },
  { title: 'privacyWhatTitle', body: 'privacyWhatBody' },
  { title: 'privacyWhereTitle', body: 'privacyWhereBody' },
  { title: 'privacyWhyTitle', body: 'privacyWhyBody' },
  { title: 'privacyNotTitle', body: 'privacyNotBody' },
  { title: 'privacyRightsTitle', body: 'privacyRightsBody' },
  { title: 'privacyRetentionTitle', body: 'privacyRetentionBody' },
];

export default function PrivacyNoticeScreen() {
  const { c } = useTokens();
  const { t } = useLocale();

  return (
    <PageShell>
      <PageHeader subtitle={t('privacyVersionLabel')} />
      <Stack>
        <ListGroup>
          {SECTIONS.map((section, index) => (
            <View
              key={section.title}
              style={[
                { padding: spacing(4), gap: spacing(1.5) },
                index > 0 && { borderTopWidth: 1, borderTopColor: c.separator },
              ]}
            >
              <Text accessibilityRole="header" style={[typography.headline, { color: c.textPrimary }]}>
                {t(section.title)}
              </Text>
              <Text style={[typography.body, { color: c.textSecondary }]}>{t(section.body)}</Text>
            </View>
          ))}
        </ListGroup>

        <Card>
          <View style={{ padding: spacing(4) }}>
            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('safetyNote')}</Text>
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
