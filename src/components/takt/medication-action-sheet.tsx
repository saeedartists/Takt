import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable, Button, CONTENT_MAX_WIDTH, Input, radius, spacing, typography, useTokens } from '@/components/ui';
import { Chip } from '@/components/takt/medication-form';
import { TimeField } from '@/components/takt/time-field';
import { useUpdateMedicationPlan } from '@/lib/hooks/use-takt-mutations';
import { useLocale } from '@/lib/takt/l10n';
import { normalizeDateInput, parseSupply } from '@/lib/takt/medication-form';
import { getSupplyCount, setSupplyCount } from '@/lib/takt/supply-tracker';
import type { MedicationPlan } from '@/lib/takt/types';

type IconName = ComponentProps<typeof Ionicons>['name'];
export type SheetStep = 'root' | 'refill' | 'pause' | 'archive';
type PlanStatus = 'active' | 'on-hold' | 'stopped';

const REFILL_PRESETS = [28, 30, 60, 90];

/** Prefill for "Duplicate": the new-medication form reads these params. */
export const duplicateParams = (plan: MedicationPlan) => ({
  name: plan.label,
  form: plan.form,
  strength: plan.strength,
  times: plan.times.join(','),
  cadence: plan.cadence,
  days: plan.dayOfWeek.join(','),
});

/** End of the current pause when one was set, so rows can say "Paused until 30 Sep". */
export const pausedUntil = (plan: MedicationPlan): Date | null => {
  if (plan.request.status !== 'on-hold') return null;
  const last = plan.pauseHistory[plan.pauseHistory.length - 1];
  if (!last?.end) return null;
  const end = new Date(last.end);
  return Number.isNaN(end.getTime()) ? null : end;
};

/** A pause ends at the end of the chosen local day. */
const endOfDayIso = (date: string): string | null => {
  if (!normalizeDateInput(date)) return null;
  const end = new Date(`${date}T00:00:00`);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
};

/** Pause / resume / archive / restore in one place; the sheet and the detail screen share it. */
export const usePlanStatusUpdate = (patientRef?: string) => {
  const updatePlan = useUpdateMedicationPlan();
  const update = async (plan: MedicationPlan, status: PlanStatus, pauseUntil?: string) => {
    if (!patientRef || !plan.medication) return;
    const supplyCount = await getSupplyCount(plan.medication.id);
    await updatePlan.mutateAsync({
      patientRef,
      name: plan.label,
      form: plan.form,
      strength: plan.strength,
      cadence: plan.cadence,
      dayOfWeek: plan.dayOfWeek,
      times: plan.times,
      supplyCount: supplyCount ?? undefined,
      status,
      pauseUntil,
      request: plan.request,
      medication: plan.medication,
    });
  };
  return { update, isPending: updatePlan.isPending };
};

type Props = {
  /** The plan the sheet is about; null keeps it closed. */
  plan: MedicationPlan | null;
  patientRef?: string;
  initialStep?: SheetStep;
  onClose: () => void;
  /** Fired after a refill or status change so parents can reload local supply. */
  onChanged?: () => void;
};

/*
 * MedicationActionSheet — the one place for Pause / Resume / Refill /
 * Duplicate / Archive / Restore. Opened from a row's "more" button on
 * the list and from the cards on the detail screen. React Native's own
 * Modal, so it works on iOS, Android and web without a dependency.
 */
export function MedicationActionSheet({ plan, patientRef, initialStep = 'root', onClose, onChanged }: Props) {
  const { c } = useTokens();
  const { t } = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const status = usePlanStatusUpdate(patientRef);

  const [step, setStep] = useState<SheetStep>(initialStep);
  const [refillInput, setRefillInput] = useState('30');
  const [pauseUntil, setPauseUntil] = useState('');
  const [pending, setPending] = useState<'status' | 'refill' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planId = plan?.request.id;
  useEffect(() => {
    setStep(initialStep);
    setRefillInput('30');
    setPauseUntil('');
    setPending(null);
    setError(null);
  }, [initialStep, planId]);

  if (!plan) return null;

  const planStatus = plan.request.status;
  const refillAmount = parseSupply(refillInput);
  const pauseUntilIso = endOfDayIso(pauseUntil);

  const changeStatus = async (next: PlanStatus, until?: string) => {
    setError(null);
    setPending('status');
    try {
      await status.update(plan, next, until);
      onChanged?.();
      onClose();
    } catch {
      setError(t('medicationStatusActionError'));
    } finally {
      setPending(null);
    }
  };

  const logRefill = async () => {
    const medicationId = plan.medication?.id;
    if (!medicationId || !refillAmount) return;
    setError(null);
    setPending('refill');
    try {
      await setSupplyCount(medicationId, ((await getSupplyCount(medicationId)) ?? 0) + refillAmount);
      onChanged?.();
      onClose();
    } finally {
      setPending(null);
    }
  };

  const duplicate = () => {
    onClose();
    router.push({ pathname: '/medications/new', params: duplicateParams(plan) } as never);
  };

  const item = (icon: IconName, label: string, onPress: () => void, destructive = false) => (
    <AnimatedPressable
      key={label}
      onPress={onPress}
      disabled={pending !== null}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${plan.label}`}
      style={[styles.item, { borderTopColor: c.separator }]}
    >
      <Ionicons name={icon} size={22} color={destructive ? c.destructive : c.textPrimary} />
      <Text style={[typography.body, { color: destructive ? c.destructive : c.textPrimary, flex: 1 }]}>{label}</Text>
    </AnimatedPressable>
  );

  const backButton = (
    <Button kind="secondary" label={t('back')} onPress={() => setStep('root')} disabled={pending !== null} />
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,18,24,0.45)' }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('cancel')}
        />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: spacing(4) + insets.bottom }]}>
          <View style={[styles.handle, { backgroundColor: c.separator }]} />
          <View style={styles.header}>
            <Text numberOfLines={1} style={[typography.title3, { color: c.textPrimary, flex: 1 }]}>
              {plan.label}
            </Text>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{plan.strength}</Text>
          </View>

          {step === 'root' ? (
            <View>
              {planStatus === 'active' ? item('pause-circle-outline', t('pauseCta'), () => setStep('pause')) : null}
              {planStatus === 'on-hold' ? item('play-circle-outline', t('resumeCta'), () => void changeStatus('active')) : null}
              {planStatus === 'stopped' ? item('refresh-circle-outline', t('restoreCta'), () => void changeStatus('active')) : null}
              {planStatus !== 'stopped' ? item('add-circle-outline', t('refillCta'), () => setStep('refill')) : null}
              {item('copy-outline', t('duplicateCta'), duplicate)}
              {planStatus !== 'stopped' ? item('archive-outline', t('archiveCta'), () => setStep('archive'), true) : null}
              <View style={styles.footer}>
                <Button kind="secondary" label={t('cancel')} onPress={onClose} disabled={pending !== null} />
              </View>
            </View>
          ) : null}

          {step === 'refill' ? (
            <View style={styles.stepBody}>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('refillAmountLabel')}</Text>
              <View style={styles.wrapRow}>
                {REFILL_PRESETS.map((amount) => (
                  <Chip
                    key={amount}
                    label={`+${amount}`}
                    selected={refillInput === amount.toString()}
                    onPress={() => setRefillInput(amount.toString())}
                  />
                ))}
              </View>
              <Input
                value={REFILL_PRESETS.some((amount) => amount.toString() === refillInput) ? '' : refillInput}
                onChangeText={(next) => setRefillInput(next.replace(/[^\d]/g, ''))}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder={t('refillCustomPlaceholder')}
                accessibilityLabel={t('refillCustomPlaceholder')}
              />
              <View style={styles.actionRow}>
                <View style={styles.grow}>{backButton}</View>
                <View style={styles.grow}>
                  <Button
                    label={refillAmount ? `${t('logRefillCta')} (+${refillAmount})` : t('logRefillCta')}
                    onPress={() => void logRefill()}
                    loading={pending === 'refill'}
                    disabled={!refillAmount || pending !== null}
                    haptic="success"
                  />
                </View>
              </View>
            </View>
          ) : null}

          {step === 'pause' ? (
            <View style={styles.stepBody}>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('pauseUntilHint')}</Text>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('pauseUntilLabel')}</Text>
              <TimeField mode="date" value={pauseUntil} onChange={setPauseUntil} accessibilityLabel={t('pauseUntilLabel')} />
              <View style={styles.actionRow}>
                <View style={styles.grow}>
                  <Button
                    kind="secondary"
                    label={t('pauseNowCta')}
                    onPress={() => void changeStatus('on-hold')}
                    loading={pending === 'status' && !pauseUntilIso}
                    disabled={pending !== null}
                  />
                </View>
                <View style={styles.grow}>
                  <Button
                    label={t('pauseUntilCta')}
                    onPress={() => {
                      if (pauseUntilIso) void changeStatus('on-hold', pauseUntilIso);
                    }}
                    loading={pending === 'status' && Boolean(pauseUntilIso)}
                    disabled={pending !== null || !pauseUntilIso}
                  />
                </View>
              </View>
              {backButton}
            </View>
          ) : null}

          {step === 'archive' ? (
            <View style={styles.stepBody} accessibilityRole="alert">
              <Text style={[typography.headline, { color: c.textPrimary }]}>{t('archiveConfirmTitle')}</Text>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('archiveConfirmBody')}</Text>
              <View style={styles.actionRow}>
                <View style={styles.grow}>{backButton}</View>
                <View style={styles.grow}>
                  <Button
                    kind="destructive"
                    label={t('archiveCta')}
                    onPress={() => void changeStatus('stopped')}
                    loading={pending === 'status'}
                    disabled={pending !== null}
                    haptic="rigid"
                  />
                </View>
              </View>
            </View>
          ) : null}

          {error ? (
            <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive, marginTop: spacing(2) }]}>
              {error}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  handle: { width: 36, height: 4, borderRadius: radius.full, alignSelf: 'center', marginBottom: spacing(3) },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: spacing(2), paddingBottom: spacing(3) },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footer: { paddingTop: spacing(3) },
  stepBody: { gap: spacing(3), paddingTop: spacing(1) },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  actionRow: { flexDirection: 'row', gap: spacing(2) },
  grow: { flex: 1, minWidth: 0 },
});
