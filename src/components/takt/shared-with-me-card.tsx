import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Button, ListGroup, ListRow, SectionHeader, spacing, typography, useTokens } from '@/components/ui';
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

  return (
    <View>
      <SectionHeader title={t('sharedWithMeTitle')} />
      <ListGroup>
        {rows.map((share, index) =>
          share.status === 'invited' ? (
            <View
              key={share.relatedPerson.id}
              style={[styles.invite, index > 0 && { borderTopWidth: 1, borderTopColor: c.separator }]}
            >
              <Text style={[typography.body, { color: c.textPrimary }]}>
                {t('sharedWithMeInviteBody').replace('{name}', share.patientLabel)}
              </Text>
              {acceptError ? (
                <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>
                  {acceptError}
                </Text>
              ) : null}
              <View style={styles.inviteActions}>
                <Button
                  size="sm"
                  label={t('sharedWithMeAccept')}
                  icon={<Ionicons name="checkmark" size={16} color={c.surface} />}
                  loading={accept.isPending}
                  disabled={!ownRef}
                  haptic="success"
                  onPress={() => {
                    if (!ownRef) return;
                    setAcceptError(null);
                    accept.mutateAsync({ share, accountRef: ownRef }).catch(() => setAcceptError(t('sharedWithMeAcceptError')));
                  }}
                />
              </View>
            </View>
          ) : (
            <ListRow
              key={share.relatedPerson.id}
              isFirst={index === 0}
              title={share.patientLabel}
              subtitle={share === firstAccepted ? statusLine : undefined}
              trailing={
                share === firstAccepted && firstToday.doses.length > 0 ? (
                  <Badge
                    label={unconfirmed > 0 ? unconfirmed.toString() : t('statusTaken')}
                    tone={unconfirmed > 0 ? 'warning' : 'success'}
                  />
                ) : undefined
              }
              accessibilityLabel={`${share.patientLabel}, ${statusLine}`}
              onPress={() =>
                router.push({ pathname: '/settings/relative-view', params: { patientRef: share.patientRef } } as never)
              }
            />
          ),
        )}
      </ListGroup>
    </View>
  );
};

const styles = StyleSheet.create({
  invite: {
    padding: spacing(4),
    gap: spacing(3),
  },
  inviteActions: {
    flexDirection: 'row',
  },
});
