import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Card, PageHeader, PageShell, Stack, spacing, typography, useMotion, useTokens } from '@/components/ui';
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
  { title: 'privacyOnDeviceTitle', body: 'privacyOnDeviceBody' },
  { title: 'privacyWhyTitle', body: 'privacyWhyBody' },
  { title: 'privacyNotTitle', body: 'privacyNotBody' },
  { title: 'privacyRightsTitle', body: 'privacyRightsBody' },
  { title: 'privacyRetentionTitle', body: 'privacyRetentionBody' },
];

export default function PrivacyNoticeScreen() {
  const { c } = useTokens();
  const { enter } = useMotion();
  const { t } = useLocale();

  return (
    <PageShell>
      <PageHeader subtitle={t('privacyVersionLabel')} />
      <Stack>
        <Animated.View entering={enter(0)}>
          <Card>
            {SECTIONS.map((section, index) => (
              <View
                key={section.title}
                style={[
                  styles.section,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
                ]}
              >
                <Text accessibilityRole="header" style={[typography.headline, { color: c.textPrimary }]}>
                  {t(section.title)}
                </Text>
                <Text style={[typography.body, { color: c.textSecondary }]}>{t(section.body)}</Text>
              </View>
            ))}
          </Card>
        </Animated.View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={20} color={c.textSecondary} />
          <Text style={[typography.footnote, styles.flex, { color: c.textSecondary }]}>{t('safetyNote')}</Text>
        </View>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  section: { padding: spacing(4), gap: spacing(1.5) },
  note: { flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start', paddingHorizontal: spacing(1) },
  flex: { flex: 1, minWidth: 0 },
});
