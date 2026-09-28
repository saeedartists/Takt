import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import {
  Badge,
  Button,
  INK,
  ListGroup,
  ListRow,
  SectionHeader,
  Tile,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import {
  useAcceptSharedInvite,
  useAccountEmail,
  useSharedWithMe,
} from '@/lib/hooks/use-family-sharing-grants';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useTodayScheduleEvents } from '@/lib/hooks/use-today-schedule-events';
import { isUnconfirmedForHours } from '@/lib/takt/family-sharing';
import { useLocale } from '@/lib/takt/l10n';

/*
 * Relative side of family sharing on the Today screen: pending
 * invitations to accept, and accepted patients to open. Renders nothing
 * for an account nobody has shared with, so the patient's Today is
 * unchanged.
 */
export const SharedWithMeCard = () => {
  const { c } = useTokens();
  const { enter, duration } = useMotion();
  const { t } = useLocale();
  const router = useRouter();

  const own = usePrimaryPatient();
  const ownRef = own.data ? `Patient/${own.data.id}` : undefined;
  const email = useAccountEmail();
  const shared = useSharedWithMe(email, ownRef);
  const accept = useAcceptSharedInvite();
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const rows = (shared.data ?? []).filter((share) => share.status !== 'revoked');
  const firstAccepted = rows.find((share) => share.status === 'accepted');
  // One quiet status line for the first shared patient; the full view has the per-dose detail.
  const firstToday = useTodayScheduleEvents(firstAccepted?.patientRef);

  if (rows.length === 0) return null;

  const now = new Date();
  const unconfirmed = firstToday.doses.filter((dose) => isUnconfirmedForHours(dose, now)).length;
  const statusLine =
    firstToday.doses.length === 0
      ? t('sharedWithMeNothingYet')
      : unconfirmed > 0
        ? t('sharedWithMeUnconfirmed').replace('{count}', unconfirmed.toString())
        : t('sharedWithMeAllGood');

  const initial = (label: string) => label.trim()[0]?.toUpperCase() ?? '·';

  return (
    <View>
      <SectionHeader title={t('sharedWithMeTitle')} />
      <View style={styles.list}>
        {rows.map((share, index) =>
          share.status === 'invited' ? (
            /* Sage = family: an invitation is a tile you can act on. */
            <Animated.View key={share.relatedPerson.id} entering={enter(index)} layout={LinearTransition.duration(duration.base)}>
              <Tile tone="sage" style={styles.invite}>
                <View style={styles.inviteHead}>
                  <View style={[styles.avatar, { backgroundColor: '#FFFFFF' }]}>
                    <Text style={[typography.title3, { color: INK }]}>{initial(share.patientLabel)}</Text>
                  </View>
                  <Text style={[typography.callout, styles.flex, { color: INK }]}>
                    {t('sharedWithMeInviteBody').replace('{name}', share.patientLabel)}
                  </Text>
                </View>
                {acceptError ? (
                  <Animated.View entering={FadeIn.duration(duration.base)} accessibilityRole="alert" style={styles.error}>
                    <Ionicons name="alert-circle" size={18} color={c.tones.rose.fg} />
                    <Text style={[typography.subhead, styles.flex, { color: c.tones.rose.fg }]}>{acceptError}</Text>
                  </Animated.View>
                ) : null}
                <Button
                  onTone
                  label={t('sharedWithMeAccept')}
                  accentIcon="checkmark"
                  loading={accept.isPending}
                  disabled={!ownRef}
                  haptic="success"
                  onPress={() => {
                    if (!ownRef) return;
                    setAcceptError(null);
                    accept.mutateAsync({ share, accountRef: ownRef }).catch(() => setAcceptError(t('sharedWithMeAcceptError')));
                  }}
                />
              </Tile>
            </Animated.View>
          ) : (
            <Animated.View key={share.relatedPerson.id} entering={enter(index)} layout={LinearTransition.duration(duration.base)}>
              <ListGroup>
                <ListRow
                  isFirst
                  title={share.patientLabel}
                  subtitle={share === firstAccepted ? statusLine : undefined}
                  leading={
                    <View style={[styles.avatar, { backgroundColor: c.tones.sage.bg }]}>
                      <Text style={[typography.title3, { color: INK }]}>{initial(share.patientLabel)}</Text>
                    </View>
                  }
                  trailing={
                    share === firstAccepted && firstToday.doses.length > 0 ? (
                      <Badge
                        size="sm"
                        label={unconfirmed > 0 ? unconfirmed.toString() : t('statusTaken')}
                        tone={unconfirmed > 0 ? 'warning' : 'success'}
                        icon={unconfirmed > 0 ? 'time-outline' : 'checkmark-circle'}
                      />
                    ) : undefined
                  }
                  accessibilityLabel={`${share.patientLabel}, ${statusLine}`}
                  onPress={() =>
                    router.push({ pathname: '/settings/relative-view', params: { patientRef: share.patientRef } } as never)
                  }
                />
              </ListGroup>
            </Animated.View>
          ),
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  list: { gap: spacing(3) },
  flex: { flex: 1, minWidth: 0 },
  invite: { gap: spacing(3) },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
});
