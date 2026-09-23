import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  LinearTransition,
  ZoomIn,
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useLocale } from '../../lib/takt/l10n';
import { describeInstruction } from '../../lib/takt/medication-form';
import type { DoseOccurrence, DoseState, SkipReason } from '../../lib/takt/types';
import { motion, radius, spacing, typography } from '../../theme/tokens';
import { useMotion } from '../../theme/use-motion';
import { useTokens } from '../../theme/use-tokens';
import { AnimatedPressable } from './animated-pressable';
import type { SkipReasonOption } from './animated-dose-row';
import { Badge } from './badge';
import { Card } from './card';
import { Button } from './controls';

export type HeroPending = 'take' | 'skip' | 'snooze' | null;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_SIZE = 56;
const RING_STROKE = 6;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

/** 56px completion ring; the dash offset springs to the new value. */
const ProgressRing = ({ pct }: { pct: number }) => {
  const { c } = useTokens();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(Math.max(0, Math.min(100, pct)) / 100, motion.spring.gentle);
  }, [pct, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - progress.value),
  }));

  return (
    <View style={styles.ring} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} stroke={c.surfaceRaised} strokeWidth={RING_STROKE} fill="none" />
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          stroke={pct >= 100 ? c.success : c.accent}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_C} ${RING_C}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <Text style={[typography.caption, styles.ringLabel, { color: c.textSecondary }]}>{`${Math.round(pct)}%`}</Text>
    </View>
  );
};

type TodayHeroCardProps = {
  patientName?: string;
  /** Today's occurrences, sorted by scheduled time. */
  doses: DoseOccurrence[];
  hasPlans: boolean;
  /** "Log your first dose" one-liner (journey step 2). */
  showFirstDoseHint: boolean;
  pending: HeroPending;
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
 * TodayHeroCard — greeting, today's count and the one thing to do right
 * now, in a single card so the timeline starts above the fold.
 * Due → Take / Skip / Snooze always visible; next → "Take early";
 * all taken → calm check; no plans → onboarding CTA. No countdown
 * (Calm UX B.13).
 */
export function TodayHeroCard({
  patientName,
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
}: TodayHeroCardProps) {
  const { c } = useTokens();
  const { t, formatTime } = useLocale();
  const { duration, reduce } = useMotion();
  const [skipOpen, setSkipOpen] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('greetingMorning') : hour < 18 ? t('greetingAfternoon') : t('greetingEvening');
  const greetingText = patientName ? `${greeting}, ${patientName}` : greeting;

  const total = doses.length;
  const taken = doses.filter((d) => d.state === 'taken').length;
  const pct = total > 0 ? Math.round((taken / total) * 100) : 0;
  const due = doses.find((d) => d.state === 'due');
  const next = doses.find((d) => d.state === 'scheduled');
  const allTaken = total > 0 && taken === total;
  const dose = due ?? next;
  const time = dose ? formatTime(dose.scheduledAt) : '';
  const summary = !hasPlans
    ? null
    : total === 0
      ? t('noDosesToday')
      : t('takenOfTotal').replace('{taken}', String(taken)).replace('{total}', String(total));

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
        <View style={styles.summaryRow}>
          <View style={styles.summaryText}>
            <Text numberOfLines={1} style={[typography.subhead, { color: c.textSecondary }]}>
              {greetingText}
            </Text>
            {summary ? (
              <Text style={[typography.headline, { color: c.textPrimary, fontVariant: ['tabular-nums'] }]}>{summary}</Text>
            ) : null}
          </View>
          {total > 0 ? <ProgressRing pct={pct} /> : null}
        </View>

        <View style={[styles.divider, { backgroundColor: c.separator }]} />

        {!hasPlans ? (
          <View style={styles.block}>
            <Badge label={t('journeyStepOneLabel')} tone="accent" />
            <Text style={[typography.headline, { color: c.textPrimary }]}>{t('journeyCardTitle')}</Text>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('journeyCardNeedMedication')}</Text>
            <Button label={t('journeyAddMedicationCta')} onPress={onAddMedication} />
          </View>
        ) : allTaken ? (
          <View style={styles.celebrateRow}>
            <Animated.View
              entering={reduce ? undefined : ZoomIn.springify().damping(14)}
              style={[styles.celebrateIcon, { backgroundColor: `${c.success}1A` }]}
            >
              <Ionicons name="checkmark-circle" size={30} color={c.success} />
            </Animated.View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[typography.headline, { color: c.textPrimary }]}>{t('allDoneToday')}</Text>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('allDoneSubtitle')}</Text>
            </View>
          </View>
        ) : dose ? (
          <View style={styles.block}>
            <View style={styles.labelRow}>
              <Text style={[typography.overline, { color: c.textSecondary }]}>{t('nextDose')}</Text>
              <Badge label={stateLabel(dose.state)} tone={due ? 'warning' : 'neutral'} />
            </View>
            <View>
              <Text style={[typography.title2, { color: c.textPrimary }]}>{dose.label}</Text>
              <Text style={[typography.subhead, { color: c.textSecondary, marginTop: 2, fontVariant: ['tabular-nums'] }]}>
                {[time, dose.strength].filter(Boolean).join(' · ')}
              </Text>
              {describeInstruction(dose, t) ? (
                <Text style={[typography.footnote, { color: c.textSecondary, marginTop: 2 }]}>{describeInstruction(dose, t)}</Text>
              ) : null}
            </View>

            {due ? (
              <>
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
                  <View style={{ flex: 1 }}>
                    <Button
                      kind="secondary"
                      label={t('markSkipped')}
                      loading={pending === 'skip'}
                      disabled={pending !== null}
                      haptic="warning"
                      accessibilityLabel={`${t('markSkipped')}, ${due.label}, ${time}`}
                      onPress={handleSkip}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      kind="secondary"
                      label={`${t('snooze')} ${snoozeMinutes} min`}
                      loading={pending === 'snooze'}
                      disabled={pending !== null}
                      accessibilityLabel={`${t('snooze')} ${snoozeMinutes} min, ${due.label}, ${time}`}
                      onPress={() => onSnooze(due)}
                    />
                  </View>
                </View>
                {skipOpen ? (
                  <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.reasonPanel}>
                    <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('skipReasonPrompt')}</Text>
                    <View style={styles.chipRow}>
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
                {showFirstDoseHint ? (
                  <Text style={[typography.footnote, { color: c.textTertiary }]}>{t('journeyCardNeedDose')}</Text>
                ) : null}
              </>
            ) : (
              <Button
                kind="secondary"
                label={t('takeEarly')}
                icon={<Ionicons name="checkmark" size={18} color={c.textPrimary} />}
                loading={pending === 'take'}
                disabled={pending !== null}
                haptic="success"
                accessibilityLabel={`${t('takeEarly')}, ${dose.label}, ${time}`}
                onPress={() => onTake(dose)}
              />
            )}
          </View>
        ) : (
          <Text style={[typography.headline, { color: c.textPrimary }]}>{t('noMoreDosesToday')}</Text>
        )}
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing(4), gap: spacing(3) },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(3) },
  summaryText: { flex: 1, minWidth: 0, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  block: { gap: spacing(3) },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(2) },
  secondaryRow: { flexDirection: 'row', gap: spacing(2) },
  reasonPanel: { gap: spacing(2) },
  chipRow: { flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing(3.5),
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  celebrateIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  ringLabel: { position: 'absolute', fontWeight: '600', fontVariant: ['tabular-nums'] },
});
