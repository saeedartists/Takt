import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Card, PageShell, Stack, spacing, typography, useMotion, useTokens } from '@/components/ui';
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
  const { enter } = useMotion();
  const { t } = useLocale();

  return (
    <PageShell>
      <Stack>
        <Animated.View entering={enter(0)}>
          <Card>
            <View style={styles.body}>
              <Text accessibilityRole="header" style={[typography.title2, { color: c.textPrimary }]}>
                {t('imprintCompany')}
              </Text>
              {LINES.map((key) => (
                <Text key={key} style={[typography.body, { color: c.textSecondary }]}>
                  {t(key)}
                </Text>
              ))}
              <View style={[styles.draft, { backgroundColor: c.tones.butter.bg }]}>
                <Ionicons name="alert-circle-outline" size={18} color={c.tones.butter.fg} />
                <Text style={[typography.footnote, styles.flex, { color: c.tones.butter.fg }]}>{t('imprintDraftNotice')}</Text>
              </View>
            </View>
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
  body: { padding: spacing(4.5), gap: spacing(2) },
  note: { flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start', paddingHorizontal: spacing(1) },
  flex: { flex: 1, minWidth: 0 },
  draft: { flexDirection: 'row', gap: spacing(2), alignItems: 'flex-start', padding: spacing(3), borderRadius: 18, marginTop: spacing(1) },
});
