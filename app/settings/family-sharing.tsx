import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  LoadingState,
  PageHeader,
  PageShell,
  SectionHeader,
  Stack,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import { useFamilySharingGrants } from '@/lib/hooks/use-family-sharing-grants';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';

export default function FamilySharingScreen() {
  const { t, formatDateTime } = useLocale();
  const { c } = useTokens();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const grants = useFamilySharingGrants(patientRef);

  if (patient.isLoading || grants.isLoading) {
    return (
      <PageShell>
        <LoadingState label={t('familySharingLoading')} />
      </PageShell>
    );
  }

  if (patient.error || grants.error) {
    return (
      <PageShell>
        <ErrorState
          description={t('familySharingLoadError')}
          onRetry={() => {
            void patient.refetch();
            void grants.refetch();
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title={t('familySharingTitle')} subtitle={t('familySharingSubtitle')} />

      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(2.5) }}>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('familySharingV10Note')}</Text>
            <Badge label={t('familySharingV11Gate')} tone="warning" />
            <Button label={t('familySharingOpenRelativeView')} kind="secondary" onPress={() => router.push('/settings/relative-view' as never)} />
          </View>
        </Card>

        <View>
          <SectionHeader title={t('familySharingGrantListTitle')} />
          {grants.grants.length === 0 ? (
            <EmptyState title={t('familySharingNoGrants')} description={t('familySharingNoGrantsHint')} />
          ) : (
            <ListGroup>
              {grants.grants.map((grant, index) => (
                <ListRow
                  key={grant.id}
                  isFirst={index === 0}
                  title={grant.relatedPersonLabel}
                  subtitle={`${t('familySharingGrantedAt')}: ${formatDateTime(new Date(grant.grantedAt))}`}
                  value={grant.status === 'granted' ? t('statusActive') : t('statusArchived')}
                />
              ))}
            </ListGroup>
          )}
        </View>

        <View>
          <SectionHeader title={t('familySharingScopeTitle')} />
          <ListGroup>
            <ListRow isFirst title={t('familySharingAllowedLine1')} value="✓" />
            <ListRow title={t('familySharingAllowedLine2')} value="✓" />
            <ListRow title={t('familySharingBlockedLine1')} value="✕" />
            <ListRow title={t('familySharingBlockedLine2')} value="✕" />
            <ListRow title={t('familySharingBlockedLine3')} value="✕" />
          </ListGroup>
        </View>
      </Stack>
    </PageShell>
  );
}
