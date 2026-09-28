import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import {
  AnimatedPressable,
  AnimatedProgressBar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  INK,
  PageShell,
  SkeletonCard,
  Stack,
  Tile,
  TileIcon,
  font,
  motion,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { MedicationActionSheet } from '@/components/takt/medication-action-sheet';
import { MedicationGlyph } from '@/components/takt/medication-glyph';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';
import { LOW_SUPPLY_THRESHOLD, getSupplySnapshot, type SupplySnapshot } from '@/lib/takt/supply-tracker';
import type { MedicationPlan } from '@/lib/takt/types';

/** Two weeks of cover reads as "all stocked"; below that the hero names the next refill. */
const STOCKED_DAYS = 14;

const reflow = LinearTransition.springify()
  .damping(motion.spring.settle.damping)
  .stiffness(motion.spring.settle.stiffness);

type Row = { plan: MedicationPlan; supply: SupplySnapshot | null };

/*
 * Refills — every active medication's supply on one page, most urgent
 * first. Butter is the supply tone; rose appears only once a medication
 * has run out. Logging a refill reuses the medication action sheet.
 */
export default function RefillsScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const { enter } = useMotion();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);

  const active = useMemo(() => plans.plans.filter((plan) => plan.request.status === 'active'), [plans.plans]);
  const [supply, setSupply] = useState<Record<string, SupplySnapshot | null> | null>(null);
  const [refillPlan, setRefillPlan] = useState<MedicationPlan | null>(null);
  // Bars start empty and fill once, so the page shows how much is left rather than just stating it.
  const [filled, setFilled] = useState(false);

  const reload = useCallback(async () => {
    const next: Record<string, SupplySnapshot | null> = {};
    for (const plan of active) {
      if (plan.medication?.id) next[plan.medication.id] = await getSupplySnapshot(plan.medication.id);
    }
    setSupply(next);
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    if (!supply) return;
    const id = setTimeout(() => setFilled(true), 120);
    return () => clearTimeout(id);
  }, [supply]);

  // Tracked medications by days left (run-out first), untracked ones last.
  const rows = useMemo<Row[]>(
    () =>
      active
        .map((plan) => ({ plan, supply: (plan.medication?.id && supply?.[plan.medication.id]) || null }))
        .sort((a, b) => (a.supply?.daysUntilRefill ?? Infinity) - (b.supply?.daysUntilRefill ?? Infinity)),
    [active, supply],
  );

  const first = rows.find((row) => row.supply);
  const isLoading = patient.isLoading || plans.isLoading || (active.length > 0 && !supply);

  const hero = () => {
    if (!first?.supply) return null;
    const days = first.supply.daysUntilRefill;
    const out = first.supply.count <= 0;
    const stocked = days >= STOCKED_DAYS;
    const title = out
      ? t('refillsHeroNow')
      : stocked
        ? t('refillsHeroStocked')
        : days === 1
          ? t('refillsHeroNextOne')
          : t('refillsHeroNext').replace('{days}', String(days));
    const sub = out
      ? t('refillsHeroOut').replace('{name}', first.plan.label)
      : stocked
        ? t('refillsHeroStockedSub')
        : t('refillsHeroFirst').replace('{name}', first.plan.label);
    return (
      <Animated.View entering={enter(0)}>
        <Tile tone="butter" style={styles.hero} accessibilityLabel={`${title}. ${sub}`}>
          <View style={styles.heroText}>
            <Text accessibilityRole="header" style={[typography.title2, { color: INK }]}>
              {title}
            </Text>
            <Text style={[typography.subhead, { color: c.tones.butter.fg }]}>{sub}</Text>
          </View>
          <TileIcon name={stocked ? 'checkmark-circle-outline' : 'bag-add-outline'} color={c.tones.butter.fg} size={44} />
        </Tile>
      </Animated.View>
    );
  };

  const row = ({ plan, supply: s }: Row, index: number) => {
    const out = Boolean(s && s.count <= 0);
    const low = Boolean(s && s.count <= LOW_SUPPLY_THRESHOLD);
    const line = !s
      ? t('refillsNotTracked')
      : out
        ? t('supplyRefillNeeded')
        : t('supplyLeftDays').replace('{count}', String(s.count)).replace('{days}', String(s.daysUntilRefill));
    const barColor = out ? c.tones.rose.solid : low ? c.tones.butter.solid : c.tones.sage.solid;
    return (
      <Animated.View key={plan.request.id} entering={enter(index + 1)} layout={reflow}>
        <Card style={styles.card}>
          <AnimatedPressable
            onPress={() => router.push({ pathname: '/medications/[id]', params: { id: plan.request.id } })}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`${plan.label}, ${line}`}
            style={styles.cardPress}
          >
            <MedicationGlyph appearance={plan.appearance} form={plan.form} size={44} />
            <View style={styles.grow}>
              <Text numberOfLines={2} style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>
                {plan.label}
              </Text>
              <View style={styles.lineRow}>
                {out || low ? (
                  <Ionicons name="alert-circle" size={15} color={out ? c.tones.rose.solid : c.tones.butter.solid} />
                ) : null}
                <Text
                  numberOfLines={2}
                  style={[
                    typography.subhead,
                    styles.tabular,
                    {
                      color: out ? c.destructive : low ? c.warning : c.textSecondary,
                      fontFamily: out || low ? font.semibold : font.regular,
                      flexShrink: 1,
                    },
                  ]}
                >
                  {line}
                </Text>
              </View>
            </View>
          </AnimatedPressable>
          <View style={styles.actionRow}>
            {s ? (
              <View style={styles.grow}>
                <AnimatedProgressBar
                  progress={filled ? Math.max(0.03, Math.min(1, s.count / s.capacity)) : 0}
                  height={6}
                  color={barColor}
                  backgroundColor={c.surfaceRaised}
                />
              </View>
            ) : (
              <View style={styles.grow} />
            )}
            <AnimatedPressable
              onPress={() => setRefillPlan(plan)}
              haptic="light"
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityLabel={(s ? t('refillsLogFor') : t('refillsSetFor')).replace('{name}', plan.label)}
              style={[styles.refill, { backgroundColor: low ? c.tones.butter.bg : c.surfaceRaised }]}
            >
              <Ionicons name="add" size={18} color={low ? INK : c.textPrimary} />
              <Text style={[typography.subhead, { color: low ? INK : c.textPrimary, fontFamily: font.bold }]}>
                {s ? t('refillCta') : t('supplySet')}
              </Text>
            </AnimatedPressable>
          </View>
        </Card>
      </Animated.View>
    );
  };

  return (
    <PageShell>
      {isLoading ? (
        <Stack>
          <SkeletonCard rows={1} />
          <SkeletonCard rows={1} />
          <SkeletonCard rows={1} />
        </Stack>
      ) : patient.error || plans.error ? (
        <ErrorState
          description={t('loadMedicationsError')}
          onRetry={() => {
            void patient.refetch();
            void plans.requestsQuery.refetch();
            void plans.medicationsQuery.refetch();
            void reload();
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('refillsEmptyTitle')}
          description={t('refillsEmptyHint')}
          action={<Button label={t('addMedication')} onPress={() => router.push('/medications/new')} />}
        />
      ) : (
        <View style={styles.page}>
          {hero()}
          <View style={styles.list}>{rows.map(row)}</View>
          <Animated.View entering={enter(rows.length + 1)} style={styles.tip}>
            <Ionicons name="bulb-outline" size={18} color={c.textTertiary} />
            <Text style={[typography.footnote, { color: c.textSecondary, flex: 1 }]}>{t('refillsTip')}</Text>
          </Animated.View>
        </View>
      )}

      <MedicationActionSheet
        plan={refillPlan}
        patientRef={patientRef}
        initialStep="refill"
        onClose={() => setRefillPlan(null)}
        onChanged={() => void reload()}
      />
    </PageShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing(4) },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), padding: spacing(5), borderRadius: radius.xxl },
  heroText: { flex: 1, minWidth: 0, gap: spacing(1) },
  list: { gap: spacing(2.5) },
  card: { padding: spacing(4), paddingBottom: spacing(3), gap: spacing(2) },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  cardPress: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  grow: { flex: 1, minWidth: 0 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  tabular: { fontVariant: ['tabular-nums'] },
  refill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingLeft: spacing(3),
    paddingRight: spacing(4),
    borderRadius: radius.full,
  },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingHorizontal: spacing(1) },
});
