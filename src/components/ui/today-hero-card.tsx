import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { useLocale } from '../../lib/takt/l10n';
import { describeInstruction } from '../../lib/takt/medication-form';
import type { DoseOccurrence, DoseState, SkipReason } from '../../lib/takt/types';
import { INK, font, radius, spacing, typography } from '../../theme/tokens';
import { useMotion } from '../../theme/use-motion';
import { useTokens } from '../../theme/use-tokens';
import { AnimatedPressable } from './animated-pressable';
import type { SkipReasonOption } from './animated-dose-row';
import { Tile } from './card';
import { Button } from './controls';

export type HeroPending = 'take' | 'skip' | 'snooze' | null;

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
 * The big translucent capsule behind the hero. It rolls in when the card
 * first appears and turns half a revolution each time the next dose
 * changes, a small "on to the next one" beat. No looping motion.
 */
const HeroCapsule = ({ turnKey }: { turnKey: string }) => {
  const { reduce } = useMotion();
  const rotation = useSharedValue(reduce ? -36 : -70);
  const shift = useSharedValue(reduce ? 0 : 40);
  const first = useRef(true);

  useEffect(() => {
    if (reduce) return;
    if (first.current) {
      first.current = false;
      rotation.value = withDelay(120, withSpring(-36, { damping: 20, stiffness: 90 }));
      shift.value = withDelay(120, withSpring(0, { damping: 22, stiffness: 110 }));
      return;
    }
    rotation.value = withTiming(rotation.value + 180, { duration: 900, easing: Easing.inOut(Easing.cubic) });
  }, [reduce, rotation, shift, turnKey]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }, { rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.capsule, style]}>
      <Svg width={170} height={170} viewBox="0 0 170 170">
        <Rect x={25} y={59} width={120} height={52} rx={26} fill="#FFFFFF" opacity={0.5} />
        <Path d="M85 59v52" stroke="#FFFFFF" strokeWidth={3} opacity={0.6} />
      </Svg>
    </Animated.View>
  );
};

/** Small chip on the hero: ink for "due now", white glass for "next". */
const HeroChip = ({ label, icon, strong }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; strong: boolean }) => (
  <View style={[styles.chip, { backgroundColor: strong ? INK : 'rgba(255,255,255,0.72)' }]}>
    <Ionicons name={icon} size={16} color={strong ? '#FAD6B4' : INK} />
    <Text style={[typography.subhead, { color: strong ? '#F5F2ED' : INK, fontFamily: font.bold, fontVariant: ['tabular-nums'] }]}>
      {label}
    </Text>
  </View>
);

/*
 * TodayHeroCard — the one thing to do right now, on the palette's pastel
 * tile. Due → Taken (ink, action dot) / Snooze / Skip; next → "Take
 * early"; all taken → a calm sage "all done"; no plans → the first step.
 * Content crossfades when the dose changes; the tile height glides.
 * No countdown, no pulsing (Calm UX B.13).
 */
export function TodayHeroCard({
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
  const { reduce } = useMotion();
  const [skipOpen, setSkipOpen] = useState(false);

  const total = doses.length;
  const taken = doses.filter((d) => d.state === 'taken').length;
  const due = doses.find((d) => d.state === 'due');
  const next = doses.find((d) => d.state === 'scheduled');
  const allTaken = total > 0 && taken === total;
  const dose = due ?? next;
  const time = dose ? formatTime(dose.scheduledAt) : '';

  useEffect(() => setSkipOpen(false), [dose?.id]);

  const handleSkip = () => {
    if (!due) return;
    if (skipReasons.length === 0) {
      onSkip(due);
      return;
    }
    setSkipOpen((open) => !open);
  };

  const layout = reduce ? undefined : LinearTransition.springify().damping(24).stiffness(200);
  const swapIn = reduce ? undefined : FadeInDown.duration(320);
  const swapOut = reduce ? undefined : FadeOut.duration(140);

  if (!hasPlans) {
    return (
      <Animated.View layout={layout}>
        <Tile tone="accent" style={styles.tile}>
          <HeroCapsule turnKey="onboarding" />
          <View style={styles.block}>
            <View style={[styles.chip, { backgroundColor: INK }]}>
              <Text style={[typography.subhead, { color: '#F5F2ED', fontFamily: font.bold }]}>{t('journeyStepOneLabel')}</Text>
            </View>
            <Text style={[typography.largeTitle, styles.onTile]}>{t('journeyCardTitle')}</Text>
            <Text style={[typography.body, { color: c.onAccentSoft }]}>{t('journeyCardNeedMedication')}</Text>
            <Button label={t('journeyAddMedicationCta')} accentIcon="add" size="lg" onTone onPress={onAddMedication} />
          </View>
        </Tile>
      </Animated.View>
    );
  }

  if (allTaken) {
    return (
      <Animated.View layout={layout} entering={swapIn}>
        <Tile tone="sage" style={styles.tile}>
          <View pointerEvents="none" style={styles.rings}>
            <View style={[styles.ring, { width: 200, height: 200, borderRadius: 100 }]} />
            <View style={[styles.ring, { width: 124, height: 124, borderRadius: 62, top: 38, left: 38 }]} />
          </View>
          <View style={styles.block}>
            <Animated.View
              entering={reduce ? undefined : ZoomIn.delay(120).springify().damping(16).stiffness(180)}
              style={[styles.doneBadge, { backgroundColor: c.tones.sage.solid }]}
            >
              <Ionicons name="checkmark" size={32} color="#FFFFFF" />
            </Animated.View>
            <Text accessibilityRole="header" style={[typography.largeTitle, styles.onTile]}>
              {t('allDoneToday')}
            </Text>
            <Text style={[typography.body, { color: c.tones.sage.fg }]}>{t('allDoneSubtitle')}</Text>
          </View>
        </Tile>
      </Animated.View>
    );
  }

  if (!dose) {
    return (
      <Animated.View layout={layout} entering={swapIn}>
        <Tile tone="surface" style={styles.tile}>
          <View style={styles.row}>
            <Ionicons name="moon-outline" size={22} color={c.textSecondary} />
            <Text style={[typography.headline, { color: c.textPrimary, flex: 1 }]}>{t('noMoreDosesToday')}</Text>
          </View>
        </Tile>
      </Animated.View>
    );
  }

  const instruction = describeInstruction(dose, t);

  return (
    <Animated.View layout={layout}>
      <Tile tone="accent" style={styles.tile}>
        <HeroCapsule turnKey={dose.id} />
        <Animated.View key={dose.id} entering={swapIn} exiting={swapOut} style={styles.block}>
          <View style={styles.labelRow}>
            <Text style={[typography.overline, { color: c.onAccentSoft }]}>{t('nextDose')}</Text>
          </View>
          <HeroChip
            label={`${stateLabel(dose.state)} · ${time}`}
            icon={due ? 'time' : 'time-outline'}
            strong={Boolean(due)}
          />
          <View>
            <Text numberOfLines={2} style={[typography.display, styles.onTile]}>
              {dose.label}
            </Text>
            <Text style={[typography.body, { color: c.onAccentSoft, marginTop: spacing(1.5) }]}>
              {[dose.strength, instruction].filter(Boolean).join(' · ')}
            </Text>
          </View>

          {due ? (
            <View style={styles.actions}>
              <Button
                label={t('confirmTaken')}
                accentIcon="checkmark"
                size="lg"
                onTone
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
                    onTone
                    label={`${t('snooze')} ${snoozeMinutes} min`}
                    loading={pending === 'snooze'}
                    disabled={pending !== null}
                    accessibilityLabel={`${t('snooze')} ${snoozeMinutes} min, ${due.label}, ${time}`}
                    onPress={() => onSnooze(due)}
                  />
                </View>
                <View style={{ flex: 0.7 }}>
                  <Button
                    kind="outline"
                    onTone
                    label={t('markSkipped')}
                    loading={pending === 'skip'}
                    disabled={pending !== null}
                    haptic="warning"
                    accessibilityLabel={`${t('markSkipped')}, ${due.label}, ${time}`}
                    onPress={handleSkip}
                  />
                </View>
              </View>
              {skipOpen ? (
                <Animated.View
                  entering={reduce ? undefined : FadeInDown.duration(220)}
                  exiting={reduce ? undefined : FadeOut.duration(120)}
                  style={styles.reasonPanel}
                >
                  <Text style={[typography.subhead, { color: c.onAccentSoft }]}>{t('skipReasonPrompt')}</Text>
                  <View style={styles.chipRow}>
                    {skipReasons.map((reason, i) => (
                      <Animated.View key={reason.code} entering={reduce ? undefined : FadeIn.delay(40 * i).duration(180)}>
                        <AnimatedPressable
                          disabled={pending !== null}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('markSkipped')}: ${reason.label}, ${due.label}, ${time}`}
                          onPress={() => {
                            setSkipOpen(false);
                            onSkip(due, reason.code);
                          }}
                          style={styles.reasonChip}
                        >
                          <Text style={[typography.subhead, { color: INK, fontFamily: font.semibold }]}>{reason.label}</Text>
                        </AnimatedPressable>
                      </Animated.View>
                    ))}
                  </View>
                </Animated.View>
              ) : null}
              {showFirstDoseHint ? (
                <Text style={[typography.subhead, { color: c.onAccentSoft }]}>{t('journeyCardNeedDose')}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.actions}>
              <Button
                kind="secondary"
                onTone
                label={t('takeEarly')}
                icon={<Ionicons name="checkmark" size={20} color={INK} />}
                loading={pending === 'take'}
                disabled={pending !== null}
                haptic="success"
                accessibilityLabel={`${t('takeEarly')}, ${dose.label}, ${time}`}
                onPress={() => onTake(dose)}
              />
            </View>
          )}
        </Animated.View>
      </Tile>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.xxl, padding: spacing(5.5) },
  onTile: { color: INK },
  block: { gap: spacing(3.5) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -spacing(1.5) },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    minHeight: 36,
    paddingLeft: spacing(2.5),
    paddingRight: spacing(3.5),
    borderRadius: radius.full,
  },
  actions: { gap: spacing(2.5), marginTop: spacing(1) },
  secondaryRow: { flexDirection: 'row', gap: spacing(2.5) },
  reasonPanel: { gap: spacing(2.5), paddingTop: spacing(1) },
  chipRow: { flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' },
  reasonChip: {
    minHeight: 44,
    paddingHorizontal: spacing(4),
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsule: { position: 'absolute', right: -34, top: -30 },
  rings: { position: 'absolute', right: -56, top: -48, width: 200, height: 200 },
  ring: { position: 'absolute', borderWidth: 18, borderColor: 'rgba(255,255,255,0.4)' },
  doneBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
