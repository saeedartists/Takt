import { StyleSheet, Text, View } from 'react-native';
import { AnimatedSegmentedControl, Card, PageShell, SectionHeader, Stack, spacing, typography, useTheme, useTokens, type ThemeMode } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

export default function AppearanceSettingsScreen() {
  const { c } = useTokens();
  const { themeMode, setThemeMode } = useTheme();
  const { locale, setLocale, t } = useLocale();

  return (
    <PageShell>
      <Stack>
        <View>
          <SectionHeader title={t('themeMode')} />
          <Card>
            <View style={styles.cardBody}>
              <AnimatedSegmentedControl
                value={themeMode}
                onChange={(next) => void setThemeMode(next as ThemeMode)}
                options={[
                  { value: 'system', label: t('themeModeSystem') },
                  { value: 'light', label: t('themeModeLight') },
                  { value: 'dark', label: t('themeModeDark') },
                ]}
              />
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('themeModeHint')}</Text>
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title={t('language')} />
          <Card>
            <View style={styles.cardBody}>
              <AnimatedSegmentedControl
                value={locale}
                onChange={(next) => void setLocale(next as 'de' | 'en')}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'de', label: 'Deutsch' },
                ]}
              />
            </View>
          </Card>
        </View>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  cardBody: { padding: spacing(4), gap: spacing(3) },
});
