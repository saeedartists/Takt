import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
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
                tone={selectedGrant.status === 'granted' ? 'accent' : 'warning'}
              />
            ) : (
              <Badge label={t('familySharingNoGrants')} tone="warning" />
            )}
            <Badge label={t('familySharingOptionalQuietReminder')} tone="neutral" />
          </View>
        </Card>

        <View>
          <SectionHeader title={t('timeline')} />
          {today.doses.length === 0 ? (
            <EmptyState title={t('noDosesToday')} description={t('familySharingRelativeNoDosesHint')} />
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
