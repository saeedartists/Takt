import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  PageHeader,
  PageShell,
  SectionHeader,
  SkeletonRow,
  Stack,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import {
  useAccountEmail,
  useFamilySharingGrants,
  useSharedWithMe,
} from '@/lib/hooks/use-family-sharing-grants';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useTodayScheduleEvents } from '@/lib/hooks/use-today-schedule-events';
import { familySharingLockedCapabilities, isUnconfirmedForHours } from '@/lib/takt/family-sharing';
import { useLocale } from '@/lib/takt/l10n';
import { doseSubtitle } from '@/lib/takt/schedule';
import type { DoseState } from '@/lib/takt/types';

/*
 * The one screen a relative gets (brief §11): today's doses for the
 * patient who invited them, with status — nothing else, no actions.
 * Opened without a `patientRef` it is the patient's own preview of what
 * a relative sees.
 */

const statusKey = (state: DoseState) =>
  state === 'due'
    ? ('statusDue' as const)
    : state === 'taken'
      ? ('statusTaken' as const)
      : state === 'skipped'
        ? ('statusSkipped' as const)
        : state === 'missed'
          ? ('statusMissed' as const)
          : ('statusScheduled' as const);

export default function RelativeViewScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ patientRef?: string; relatedPersonRef?: string }>();

  const own = usePrimaryPatient();
  const ownRef = own.data ? `Patient/${own.data.id}` : undefined;
  const isPreview = !params.patientRef || params.patientRef === ownRef;

  const email = useAccountEmail();
  const shared = useSharedWithMe(email, ownRef);
  const share = isPreview ? undefined : shared.data?.find((item) => item.patientRef === params.patientRef);

  // Revocation must take effect immediately: re-check the grant every time the screen is shown.
  useFocusEffect(
    useCallback(() => {
      if (!isPreview) void shared.refetch();
    }, [isPreview, shared]),
  );

  const targetRef = isPreview ? ownRef : share?.status === 'accepted' ? share.patientRef : undefined;
  const today = useTodayScheduleEvents(targetRef);
  const ownGrants = useFamilySharingGrants(isPreview ? ownRef : undefined);

  const previewGrant = useMemo(
    () =>
      ownGrants.grants.find((grant) => grant.relatedPersonRef === params.relatedPersonRef) ??
      ownGrants.grants.find((grant) => grant.status === 'granted'),
    [ownGrants.grants, params.relatedPersonRef],
  );

  const now = new Date();
  const unconfirmed = today.doses.filter((dose) => isUnconfirmedForHours(dose, now)).length;

  const lockedLines = useMemo(
    () =>
      familySharingLockedCapabilities.map((capability) =>
        capability === 'edit-regimen'
          ? t('familySharingBlockedLine1')
          : capability === 'view-diary'
            ? t('familySharingBlockedLine2')
            : t('familySharingBlockedLine3'),
      ),
    [t],
  );

  const title = isPreview
    ? t('familySharingRelativeTitle')
    : t('relativeViewingPatient').replace('{name}', share?.patientLabel ?? '');

  const isLoading = own.isLoading || (isPreview ? ownGrants.isLoading : shared.isLoading) || today.isLoading;
  const error = own.error ?? (isPreview ? ownGrants.error : shared.error) ?? today.error;

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title={title} subtitle={t('familySharingRelativeSubtitle')} />
        <Card>
          <SkeletonRow isFirst />
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <ErrorState
          description={t('familySharingRelativeLoadError')}
          onRetry={() => {
            void own.refetch();
            void shared.refetch();
            void today.refetch();
          }}
        />
      </PageShell>
    );
  }

  const blocked =
    !isPreview && (!share || share.status !== 'accepted') ? (
      <EmptyState
        title={
          !share
            ? t('familySharingNoGrants')
            : share.status === 'revoked'
              ? t('familySharingAccessRevokedTitle')
              : t('familySharingStatusInvited')
        }
        description={
          !share
            ? t('familySharingRelativeNoGrantSelectedHint')
            : share.status === 'revoked'
              ? t('familySharingAccessRevokedHint')
              : t('relativeInviteNotAccepted')
        }
        action={<Button kind="secondary" label={t('today')} onPress={() => router.replace('/(tabs)/today')} />}
      />
    ) : null;

  return (
    <PageShell>
      <PageHeader title={title} subtitle={t('familySharingRelativeSubtitle')} />
      <Stack>
        {isPreview ? (
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(2) }}>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('familySharingRelativeGuardrail')}</Text>
              {previewGrant ? (
                <Badge label={t('relativePreviewMode').replace('{name}', previewGrant.relatedPersonLabel)} tone="accent" />
              ) : null}
            </View>
          </Card>
        ) : null}

        {blocked ?? (
          <View>
            <SectionHeader
              title={t('timeline')}
              action={
                today.doses.length > 0 ? (
                  <Badge
                    label={
                      unconfirmed > 0
                        ? t('sharedWithMeUnconfirmed').replace('{count}', unconfirmed.toString())
                        : t('sharedWithMeAllGood')
                    }
                    tone={unconfirmed > 0 ? 'warning' : 'success'}
                  />
                ) : undefined
              }
            />
            {today.doses.length === 0 ? (
              <EmptyState title={t('noDosesToday')} description={t('familySharingRelativeNoDosesHint')} />
            ) : (
              <ListGroup>
                {today.doses.map((dose, index) => {
                  const late = isUnconfirmedForHours(dose, now);
                  return (
                    <ListRow
                      key={dose.id}
                      isFirst={index === 0}
                      title={dose.label}
                      subtitle={doseSubtitle(dose)}
                      meta={late ? <Badge label={t('relativeUnconfirmedBadge')} tone="warning" /> : undefined}
                      trailing={
                        <Badge
                          label={t(statusKey(dose.state))}
                          tone={dose.state === 'taken' ? 'success' : dose.state === 'due' ? 'accent' : 'neutral'}
                        />
                      }
                    />
                  );
                })}
              </ListGroup>
            )}
            <Text style={[typography.footnote, { color: c.textTertiary, marginTop: spacing(2), paddingHorizontal: spacing(1) }]}>
              {t('familySharingOptionalQuietReminder')}
            </Text>
          </View>
        )}

        <View>
          <SectionHeader title={t('familySharingRelativeBlockedTitle')} />
          <ListGroup>
            {lockedLines.map((line, index) => (
              <ListRow
                key={line}
                isFirst={index === 0}
                title={line}
                trailing={<Ionicons name="close-circle" size={20} color={c.textTertiary} />}
              />
            ))}
          </ListGroup>
        </View>
      </Stack>
    </PageShell>
  );
}
