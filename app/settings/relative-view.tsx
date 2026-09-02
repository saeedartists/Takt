import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
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
import { familySharingLockedCapabilities } from '@/lib/takt/family-sharing';
import { doseSubtitle } from '@/lib/takt/schedule';
import { useTodayScheduleEvents } from '@/lib/hooks/use-today-schedule-events';
import { useLocale } from '@/lib/takt/l10n';

const statusKey = (
  state: 'scheduled' | 'due' | 'taken' | 'skipped' | 'missed',
): 'statusScheduled' | 'statusDue' | 'statusTaken' | 'statusSkipped' | 'statusMissed' => {
  if (state === 'due') return 'statusDue';
  if (state === 'taken') return 'statusTaken';
  if (state === 'skipped') return 'statusSkipped';
  if (state === 'missed') return 'statusMissed';
  return 'statusScheduled';
};

export default function RelativeViewScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ relatedPersonRef?: string }>();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const today = useTodayScheduleEvents(patientRef);
  const grants = useFamilySharingGrants(patientRef);

  const selectedGrant = useMemo(() => {
    if (!params.relatedPersonRef) {
      return grants.grants.find((grant) => grant.status === 'granted') ?? grants.grants[0];
    }
    return (
      grants.grants.find((grant) => grant.relatedPersonRef === params.relatedPersonRef) ??
      grants.grants[0]
    );
  }, [grants.grants, params.relatedPersonRef]);

  const lockedLabel = useMemo(
    () =>
      familySharingLockedCapabilities.map((capability) => {
        if (capability === 'edit-regimen') return t('familySharingBlockedLine1');
        if (capability === 'view-diary') return t('familySharingBlockedLine2');
        return t('familySharingBlockedLine3');
      }),
    [t],
  );

  if (patient.isLoading || today.isLoading || grants.isLoading) {
    return (
      <PageShell>
        <LoadingState label={t('familySharingRelativeLoading')} />
      </PageShell>
    );
  }

  if (patient.error || today.error || grants.error) {
    return (
      <PageShell>
        <ErrorState
          description={t('familySharingRelativeLoadError')}
          onRetry={() => {
            void patient.refetch();
            void today.refetch();
            void grants.refetch();
          }}
        />
      </PageShell>
    );
  }

  const hasViewAccess = selectedGrant?.status === 'granted';

  return (
    <PageShell>
      <PageHeader title={t('familySharingRelativeTitle')} subtitle={t('familySharingRelativeSubtitle')} />
      <Stack>
        <Card>
          <View style={{ gap: spacing(2) }}>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>
              {t('familySharingRelativeGuardrail')}
            </Text>
            {selectedGrant ? (
              <Badge
                label={t('familySharingViewingAs').replace('{name}', selectedGrant.relatedPersonLabel)}
                tone={hasViewAccess ? 'accent' : 'warning'}
              />
            ) : (
              <Badge label={t('familySharingNoGrants')} tone="warning" />
            )}
            {!hasViewAccess && selectedGrant ? (
              <Text style={[typography.footnote, { color: c.destructive }]}>
                {t('familySharingAccessRevokedHint')}
              </Text>
            ) : null}
            <Badge label={t('familySharingOptionalQuietReminder')} tone="neutral" />
          </View>
        </Card>

        {!selectedGrant ? (
          <EmptyState
            title={t('familySharingNoGrants')}
            description={t('familySharingRelativeNoGrantSelectedHint')}
            action={
              <Button
                label={t('familySharingBackToManage')}
                onPress={() => router.replace('/settings/family-sharing' as never)}
              />
            }
          />
        ) : !hasViewAccess ? (
          <EmptyState
            title={t('familySharingAccessRevokedTitle')}
            description={t('familySharingAccessRevokedHint')}
            action={
              <Button
                kind="secondary"
                label={t('familySharingBackToManage')}
                onPress={() => router.replace('/settings/family-sharing' as never)}
              />
            }
          />
        ) : (
          <View>
            <SectionHeader title={t('timeline')} />
            {today.doses.length === 0 ? (
              <EmptyState
                title={t('noDosesToday')}
                description={t('familySharingRelativeNoDosesHint')}
              />
            ) : (
              <ListGroup>
                {today.doses.map((dose, index) => (
                  <ListRow
                    key={dose.id}
                    isFirst={index === 0}
                    title={dose.label}
                    subtitle={doseSubtitle(dose)}
                    value={t(statusKey(dose.state))}
                  />
                ))}
              </ListGroup>
            )}
          </View>
        )}

        <View>
          <SectionHeader title={t('familySharingRelativeBlockedTitle')} />
          <ListGroup>
            {lockedLabel.map((line, index) => (
              <ListRow key={line} isFirst={index === 0} title={line} value="✕" />
            ))}
          </ListGroup>
        </View>
      </Stack>
    </PageShell>
  );
}
