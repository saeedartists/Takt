import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
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
  INK,
  Tile,
  TileIcon,
  font,
  spacing,
  typography,
  useMotion,
  useTokens,
  type BadgeTone,
  type IconName,
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

/* Status as a badge with an icon, so it never rests on colour alone. */
const STATUS_BADGE: Record<DoseState, { tone: BadgeTone; icon: IconName }> = {
  taken: { tone: 'success', icon: 'checkmark-circle' },
  due: { tone: 'accent', icon: 'time-outline' },
  missed: { tone: 'destructive', icon: 'alert-circle' },
  skipped: { tone: 'neutral', icon: 'play-skip-forward-outline' },
  scheduled: { tone: 'neutral', icon: 'ellipse-outline' },
};

export default function RelativeViewScreen() {
  const { c } = useTokens();
  const { enter } = useMotion();
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
          <Animated.View entering={enter(0)}>
            <Tile tone="sage" style={styles.guard}>
              <View style={styles.guardRow}>
                <TileIcon name="eye-outline" size={44} />
                <Text style={[typography.body, styles.flex, { color: INK }]}>{t('familySharingRelativeGuardrail')}</Text>
              </View>
              {previewGrant ? (
                <Text style={[typography.subhead, { color: c.tones.sage.fg, fontFamily: font.semibold }]}>
                  {t('relativePreviewMode').replace('{name}', previewGrant.relatedPersonLabel)}
                </Text>
              ) : null}
            </Tile>
          </Animated.View>
        ) : null}

        {blocked ?? (
          <Animated.View entering={enter(1)}>
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
                    icon={unconfirmed > 0 ? 'time-outline' : 'checkmark-circle'}
                    size="sm"
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
                      meta={late ? <Badge size="sm" icon="time-outline" label={t('relativeUnconfirmedBadge')} tone="warning" /> : undefined}
                      trailing={
                        <Badge
                          size="sm"
                          label={t(statusKey(dose.state))}
                          tone={STATUS_BADGE[dose.state].tone}
                          icon={STATUS_BADGE[dose.state].icon}
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
          </Animated.View>
        )}

        <Animated.View entering={enter(2)}>
          <SectionHeader title={t('familySharingRelativeBlockedTitle')} />
          <Card>
            <View style={styles.locked}>
              {lockedLines.map((line) => (
                <View key={line} style={styles.lockedLine}>
                  <View style={[styles.lockIcon, { backgroundColor: c.surfaceRaised }]}>
                    <Ionicons name="lock-closed-outline" size={16} color={c.textSecondary} />
                  </View>
                  <Text style={[typography.body, styles.flex, { color: c.textSecondary }]}>{line}</Text>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  guard: { gap: spacing(3) },
  guardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3.5) },
  locked: { padding: spacing(4.5), gap: spacing(3) },
  lockedLine: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  lockIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
