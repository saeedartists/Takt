import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AnimatedPressable,
  AnimatedSegmentedControl,
  Badge,
  Button,
  font,
  motion,
  radius,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import { MedicationGlyph } from '@/components/takt/medication-glyph';
import { TimeField } from '@/components/takt/time-field';
import { useLocale } from '@/lib/takt/l10n';
import type { SkipReason, MedicationPlan } from '@/lib/takt/types';
import { historyLayoutGlide, STATE_META, type CorrectionAction, type DoseWithDay } from './_history-shared';

const reasonKey = (code: SkipReason) =>
  code === 'forgot'
    ? ('skipReasonForgot' as const)
    : code === 'side-effects'
      ? ('skipReasonSideEffects' as const)
      : code === 'ran-out'
        ? ('skipReasonRanOut' as const)
        : code === 'not-needed'
          ? ('skipReasonNotNeeded' as const)
          : ('skipReasonOther' as const);

const clockOf = (iso: string): string => {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/*
 * One logged dose. Collapsed: glyph, name · time, status badge. Tapping
 * opens the editor in place (the card grows with a layout glide); a status
 * change or new time is saved at once, as before.
 */
export const DoseLogRow = ({
  dose,
  plan,
  expanded,
  pending,
  disabled,
  onToggle,
  onChangeState,
  onChangeTime,
  onClear,
}: {
  dose: DoseWithDay;
  plan?: MedicationPlan;
  expanded: boolean;
  pending: boolean;
  disabled: boolean;
  onToggle: () => void;
  onChangeState: (next: CorrectionAction) => void;
  onChangeTime: (next: string) => void;
  onClear: () => void;
}) => {
  const { c } = useTokens();
  const { t, formatTime } = useLocale();
  const state = dose.state as CorrectionAction;
  const meta = STATE_META[state];
  const time = formatTime(dose.scheduledAt);
  const statusLabel = state === 'taken' ? t('statusTaken') : state === 'skipped' ? t('statusSkipped') : t('statusMissed');
  const detail = expanded
    ? t('historyEditHint')
    : state === 'taken' && dose.eventTimestamp
      ? `${t('takenAtLabel')} ${formatTime(new Date(dose.eventTimestamp))}`
      : dose.reasonCode
        ? t(reasonKey(dose.reasonCode))
        : null;

  return (
    <Animated.View
      layout={historyLayoutGlide}
      style={[styles.logRow, { backgroundColor: c.surface, borderColor: expanded ? c.textPrimary : 'transparent' }]}
    >
      <AnimatedPressable
        onPress={onToggle}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`${dose.label}, ${time}, ${statusLabel}`}
        accessibilityHint={expanded ? t('historyCloseEditor') : t('historyEditHint')}
        accessibilityState={{ expanded }}
        style={styles.rowHead}
      >
        <MedicationGlyph appearance={plan?.appearance} form={plan?.form} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>
            {dose.label}
          </Text>
          <Text style={[typography.subhead, { color: c.textSecondary }]}>{[time, detail].filter(Boolean).join(' · ')}</Text>
        </View>
        {pending ? (
          <ActivityIndicator size="small" color={c.textSecondary} accessibilityLabel={t('historyUpdating')} />
        ) : expanded ? (
          <View style={[styles.chevron, { backgroundColor: c.surfaceRaised }]}>
            <Ionicons name="chevron-up" size={20} color={c.textPrimary} />
          </View>
        ) : (
          <View>
            <Badge label={statusLabel} tone={meta.badge} icon={meta.icon} size="sm" />
          </View>
        )}
      </AnimatedPressable>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(motion.duration.base)} style={styles.editor}>
          <View
            pointerEvents={disabled ? 'none' : 'auto'}
            accessibilityState={{ disabled, busy: pending }}
            style={{ opacity: disabled ? 0.5 : 1 }}
          >
            <AnimatedSegmentedControl
              value={state}
              thumbColor={meta.thumb}
              onChange={(next) => onChangeState(next as CorrectionAction)}
              options={[
                { value: 'taken', label: t('statusTaken') },
                { value: 'skipped', label: t('statusSkipped') },
                { value: 'missed', label: t('statusMissed') },
              ]}
            />
          </View>

          {state === 'taken' && dose.eventTimestamp ? (
            <View style={styles.takenAt}>
              <Text style={[typography.callout, { color: c.textPrimary, fontFamily: font.semibold }]}>{t('takenAtLabel')}</Text>
              <View style={{ flex: 1 }}>
                <TimeField
                  mode="time"
                  value={clockOf(dose.eventTimestamp)}
                  onChange={onChangeTime}
                  accessibilityLabel={`${t('takenAtLabel')}, ${dose.label}`}
                />
              </View>
            </View>
          ) : null}

          {dose.eventId ? (
            <Button
              kind="destructive"
              size="sm"
              fullWidth={false}
              icon={<Ionicons name="trash-outline" size={16} color={c.tones.rose.fg} />}
              label={t('historyClearDoseLogCta')}
              onPress={onClear}
              disabled={disabled}
            />
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  logRow: { borderRadius: radius.xl, borderWidth: 2, padding: spacing(3.5), gap: spacing(3.5) },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  chevron: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  editor: { gap: spacing(3.5) },
  takenAt: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
});
