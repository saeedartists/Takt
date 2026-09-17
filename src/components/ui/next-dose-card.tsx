import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useLocale } from '../../lib/takt/l10n';
import type { DoseOccurrence, DoseState } from '../../lib/takt/types';
import { spacing, typography } from '../../theme/tokens';
import { useTokens } from '../../theme/use-tokens';
import { Badge } from './badge';
import { Card } from './card';
import { CelebrationCard } from './celebration-card';
import { Button } from './controls';

export type NextDosePending = 'take' | 'skip' | 'snooze' | null;

type NextDoseCardProps = {
  /** Today's occurrences, sorted by scheduled time. */
  doses: DoseOccurrence[];
  hasPlans: boolean;
  /** "Log your first dose" one-liner (journey step 2). */
  showFirstDoseHint: boolean;
  pending: NextDosePending;
  snoozeMinutes: number;
  stateLabel: (state: DoseState) => string;
  onTake: (dose: DoseOccurrence) => void;
  onSkip: (dose: DoseOccurrence) => void;
  onSnooze: (dose: DoseOccurrence) => void;
  onAddMedication: () => void;
};

/*
 * NextDoseCard — the one thing to do right now. Due → primary Take;
 * nothing due → static "Next dose at 18:00 · Metformin" (no countdown,
 * Calm UX B.13); all taken → celebration; no plans → onboarding CTA.
 */
export function NextDoseCard({
  doses,
  hasPlans,
  showFirstDoseHint,
  pending,
  snoozeMinutes,
  stateLabel,
  onTake,
  onSkip,
  onSnooze,
  onAddMedication,
}: NextDoseCardProps) {
  const { c } = useTokens();
  const { t, formatTime } = useLocale();

  if (!hasPlans) {
    return (
      <Card>
        <View style={styles.body}>
          <Badge label={t('journeyStepOneLabel')} tone="accent" />
          <Text style={[typography.headline, { color: c.textPrimary }]}>{t('journeyCardTitle')}</Text>
          <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('journeyCardNeedMedication')}</Text>
          <Button label={t('journeyAddMedicationCta')} onPress={onAddMedication} />
        </View>
      </Card>
    );
  }

  const due = doses.find((d) => d.state === 'due');
  const next = doses.find((d) => d.state === 'scheduled');
  const allTaken = doses.length > 0 && doses.every((d) => d.state === 'taken');

  if (!due && allTaken) {
    return (
      <CelebrationCard
        title={t('allDoneToday')}
        subtitle={t('allDoneSubtitle')}
        count={doses.length}
        loggedLabel={t('logged')}
      />
    );
  }

  const dose = due ?? next;
  const time = dose ? formatTime(dose.scheduledAt) : '';

  return (
    <Card>
      <Animated.View layout={LinearTransition} style={styles.body}>
        <View style={styles.labelRow}>
          <Text style={[typography.overline, { color: c.textSecondary }]}>{t('nextDose')}</Text>
          {dose ? <Badge label={stateLabel(dose.state)} tone={due ? 'warning' : 'neutral'} /> : null}
        </View>

        {due ? (
          <>
            <View>
              <Text style={[typography.title2, { color: c.textPrimary }]}>{due.label}</Text>
              <Text style={[typography.subhead, { color: c.textSecondary, marginTop: 2, fontVariant: ['tabular-nums'] }]}>
                {[time, due.strength].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Button
              label={t('confirmTaken')}
              icon={<Ionicons name="checkmark" size={18} color={c.surface} />}
              loading={pending === 'take'}
              disabled={pending !== null}
              haptic="success"
              accessibilityLabel={`${t('confirmTaken')}, ${due.label}, ${time}`}
              onPress={() => onTake(due)}
            />
            <View style={styles.secondaryRow}>
              <Button
                kind="secondary"
                size="sm"
                label={t('markSkipped')}
                loading={pending === 'skip'}
                disabled={pending !== null}
                haptic="warning"
                accessibilityLabel={`${t('markSkipped')}, ${due.label}, ${time}`}
                onPress={() => onSkip(due)}
              />
              <Button
                kind="secondary"
                size="sm"
                label={`${t('snooze')} ${snoozeMinutes} min`}
                loading={pending === 'snooze'}
                disabled={pending !== null}
                accessibilityLabel={`${t('snooze')} ${snoozeMinutes} min, ${due.label}, ${time}`}
                onPress={() => onSnooze(due)}
              />
            </View>
          </>
        ) : (
          <Text style={[typography.headline, { color: c.textPrimary, fontVariant: ['tabular-nums'] }]}>
            {next
              ? t('nextDoseAt').replace('{time}', time).replace('{label}', next.label)
              : t('noMoreDosesToday')}
          </Text>
        )}

        {showFirstDoseHint && due ? (
          <Text style={[typography.footnote, { color: c.textTertiary }]}>{t('journeyCardNeedDose')}</Text>
        ) : null}
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing(4), gap: spacing(3) },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(2) },
  secondaryRow: { flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' },
});
