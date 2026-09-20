import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useLocale } from '../../lib/takt/l10n';
import type { DoseOccurrence, DoseState, SkipReason } from '../../lib/takt/types';
import { radius, spacing, typography } from '../../theme/tokens';
import { useMotion } from '../../theme/use-motion';
import { useTokens } from '../../theme/use-tokens';
import { AnimatedPressable } from './animated-pressable';
import type { SkipReasonOption } from './animated-dose-row';
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
  /** Reasons offered when skipping; empty list skips without asking. */
  skipReasons?: SkipReasonOption[];
  onTake: (dose: DoseOccurrence) => void;
  onSkip: (dose: DoseOccurrence, reason?: SkipReason) => void;
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
  skipReasons = [],
  onTake,
  onSkip,
  onSnooze,
  onAddMedication,
}: NextDoseCardProps) {
  const { c } = useTokens();
  const { t, formatTime } = useLocale();
  const { duration } = useMotion();
  const [skipOpen, setSkipOpen] = useState(false);

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

  const handleSkip = () => {
    if (!due) return;
    if (skipReasons.length === 0) {
      onSkip(due);
      return;
    }
    setSkipOpen((open) => !open);
  };

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
                onPress={handleSkip}
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

            {skipOpen ? (
              <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.reasonPanel}>
                <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('skipReasonPrompt')}</Text>
                <View style={styles.secondaryRow}>
                  {skipReasons.map((reason) => (
                    <AnimatedPressable
                      key={reason.code}
                      disabled={pending !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('markSkipped')}: ${reason.label}, ${due.label}, ${time}`}
                      onPress={() => {
                        setSkipOpen(false);
                        onSkip(due, reason.code);
                      }}
                      style={[styles.chip, { backgroundColor: c.surfaceRaised, borderColor: c.separator }]}
                    >
                      <Text style={[typography.subhead, { color: c.textPrimary, fontWeight: '600' }]}>{reason.label}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
              </Animated.View>
            ) : null}
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
  reasonPanel: { gap: spacing(2) },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing(3.5),
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
