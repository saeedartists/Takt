import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  ListGroup,
  ListRow,
  PageHeader,
  PageShell,
  SectionHeader,
  SegmentedControl,
  Stack,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import { CONSENT_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';

export default function SettingsTabScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { locale, setLocale, t } = useLocale();

  return (
    <PageShell>
      <PageHeader title={t('settings')} />

      <Stack>
        <View>
          <SectionHeader title={t('language')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <SegmentedControl
                value={locale}
                onChange={(next) => void setLocale(next as 'de' | 'en')}
                options={[
                  { value: 'de', label: 'Deutsch' },
                  { value: 'en', label: 'English' },
                ]}
              />
              <Badge label={locale === 'de' ? t('languageActiveDe') : t('languageActiveEn')} tone="accent" />
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title={t('legal')} />
          <ListGroup>
            <ListRow isFirst title={t('privacyNotice')} onPress={() => router.push('/settings/privacy')} />
            <ListRow title={t('imprint')} onPress={() => router.push('/settings/imprint')} />
          </ListGroup>
        </View>

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('safetyNote')}</Text>
            <Button
              label={t('withdrawConsent')}
              kind="destructive"
              onPress={() => {
                void AsyncStorage.removeItem(CONSENT_STORAGE_KEY);
                router.replace('/consent');
              }}
            />
          </View>
        </Card>
      </Stack>
    </PageShell>
  );
}
