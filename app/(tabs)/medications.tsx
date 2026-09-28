import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedPressable,
  AnimatedProgressBar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  INK,
  Input,
  PageHeader,
  PageShell,
  SectionHeader,
  SkeletonRow,
  Stack,
  font,
  motion,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { MedicationActionSheet, pausedUntil, type SheetStep } from '@/components/takt/medication-action-sheet';
import { MedicationGlyph } from '@/components/takt/medication-glyph';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';
import { describeCadence } from '@/lib/takt/medication-form';
import { parseDateOnly } from '@/lib/takt/schedule';
import { LOW_SUPPLY_THRESHOLD, getSupplySnapshot, type SupplySnapshot } from '@/lib/takt/supply-tracker';
import type { MedicationPlan } from '@/lib/takt/types';

/** Most people have three to five medications; a search box only earns its place beyond that. */
const SEARCH_FROM = 6;
const CLEAR_HIT = 48;

const reflow = LinearTransition.springify()
  .damping(motion.spring.gentle.damping)
  .stiffness(motion.spring.gentle.stiffness);

type SupplyMap = Record<string, SupplySnapshot | null>;

export default function MedicationsScreen() {
  const { c, isDark } = useTokens();
  const { t, formatDate } = useLocale();
  const { enter, duration } = useMotion();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);

  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [supplyByMedication, setSupplyByMedication] = useState<SupplyMap>({});
  const [sheet, setSheet] = useState<{ plan: MedicationPlan; step: SheetStep } | null>(null);

  const isLoading = patient.isLoading || plans.isLoading;
  // Stagger rows once, on the first render that has data; later changes only re-layout.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (!isLoading) firstLoad.current = false;
  }, [isLoading]);

  const refreshSupply = useCallback(async () => {
    const next: SupplyMap = {};
    for (const plan of plans.plans) {
      const medicationId = plan.medication?.id;
      if (!medicationId) continue;
      next[medicationId] = await getSupplySnapshot(medicationId);
    }
    setSupplyByMedication(next);
  }, [plans.plans]);

  useFocusEffect(
    useCallback(() => {
      void refreshSupply();
    }, [refreshSupply]),
  );

  const filteredPlans = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return plans.plans;
    return plans.plans.filter((plan) =>
      `${plan.label} ${plan.form ?? ''} ${plan.strength ?? ''}`.toLowerCase().includes(search),
    );
  }, [plans.plans, searchTerm]);

  const activePlans = filteredPlans.filter((plan) => plan.request.status === 'active');
  const pausedPlans = filteredPlans.filter((plan) => plan.request.status === 'on-hold');
  const archivedPlans = filteredPlans.filter((plan) => plan.request.status === 'stopped');

  // "Every 2 days · 08:00 · 5 mg · Ends 30 Sep" — as-needed plans show their cap instead of times.
  const subtitle = (plan: MedicationPlan): string => {
    const end = parseDateOnly(plan.endDate);
    return [
      describeCadence(plan, t),
      plan.cadence === 'as-needed'
        ? plan.maxPerDay
          ? t('asNeededUpTo').replace('{count}', String(plan.maxPerDay))
          : undefined
        : plan.times.join(', '),
      plan.strength || plan.form || t('formNotSet'),
      end ? t('courseEndsOn').replace('{date}', formatDate(end, { day: 'numeric', month: 'short' })) : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  // Third line, by priority: pause end, then the supply state, or the way to set one.
  const rowMeta = (plan: MedicationPlan) => {
    if (plan.request.status === 'on-hold') {
      const until = pausedUntil(plan);
      return (
        <Badge
          size="sm"
          icon="pause"
          label={until ? t('pausedUntil').replace('{date}', formatDate(until, { day: 'numeric', month: 'short' })) : t('statusPaused')}
        />
      );
    }
    if (plan.request.status === 'stopped') return undefined;

    const supply = supplyOf(plan);
    if (supply === undefined) return undefined;
    if (supply === null) return t('supplySet');
    if (supply.count <= 0) return <Badge size="sm" icon="alert-circle" label={t('supplyRefillNeeded')} tone="destructive" />;
    return t('supplyLeftDays')
      .replace('{count}', String(supply.count))
      .replace('{days}', String(supply.daysUntilRefill));
  };

  const supplyOf = (plan: MedicationPlan) => {
    const medicationId = plan.medication?.id;
    return medicationId ? supplyByMedication[medicationId] : undefined;
  };
  const isLow = (plan: MedicationPlan) => {
    const supply = supplyOf(plan);
    return plan.request.status === 'active' && Boolean(supply) && (supply?.count ?? 0) <= LOW_SUPPLY_THRESHOLD;
  };

  const open = (plan: MedicationPlan) => router.push({ pathname: '/medications/[id]', params: { id: plan.request.id } });

  const moreButton = (plan: MedicationPlan, onTone: boolean) => (
    <AnimatedPressable
      onPress={() => setSheet({ plan, step: 'root' })}
      accessibilityRole="button"
      accessibilityLabel={t('moreActionsFor').replace('{name}', plan.label)}
      scaleTo={0.9}
      style={[styles.more, { backgroundColor: onTone ? 'rgba(255,255,255,0.7)' : c.surfaceRaised }]}
    >
      <Ionicons name="ellipsis-horizontal" size={20} color={onTone ? INK : c.textPrimary} />
    </AnimatedPressable>
  );

  /** Low supply: promoted to a butter tile with the bar, so the refill is the first thing seen. */
  const lowTile = (plan: MedicationPlan) => {
    const supply = supplyOf(plan);
    const butter = c.tones.butter;
    const count = supply?.count ?? 0;
    const line = [
      count <= 0 ? t('supplyRefillNeeded') : t('supplyLeft').replace('{count}', String(count)),
      count <= 0 ? undefined : t('supplyLow'),
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <View style={[styles.card, styles.lowCard, { backgroundColor: butter.bg }]}>
        <View style={styles.cardRow}>
          <AnimatedPressable
            onPress={() => open(plan)}
            haptic="light"
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`${plan.label}, ${subtitle(plan)}`}
            style={styles.cardPress}
          >
            <View style={styles.glass}>
              <MedicationGlyph appearance={plan.appearance} form={plan.form} size={40} />
            </View>
            <View style={styles.grow}>
              <Text numberOfLines={2} style={[typography.headline, styles.name, { color: INK }]}>
                {plan.label}
              </Text>
              <Text style={[typography.subhead, { color: butter.fg }]}>{subtitle(plan)}</Text>
            </View>
          </AnimatedPressable>
          {moreButton(plan, true)}
        </View>
        <View style={styles.supplyRow}>
          <View style={styles.grow}>
            <AnimatedProgressBar
              progress={supply ? Math.max(0.02, count / supply.capacity) : 0}
              height={8}
              color={butter.fg}
              backgroundColor="rgba(255,255,255,0.7)"
            />
          </View>
          <Ionicons name="alert-circle" size={18} color={butter.fg} />
          <Text style={[typography.subhead, { color: butter.fg, fontFamily: font.bold }]}>{line}</Text>
        </View>
      </View>
    );
  };

  const card = (plan: MedicationPlan) => {
    const meta = rowMeta(plan);
    const archived = plan.request.status === 'stopped';
    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.cardBorder, borderWidth: isDark ? StyleSheet.hairlineWidth : 0 }]}>
        <View style={styles.cardRow}>
          <AnimatedPressable
            onPress={() => open(plan)}
            haptic="light"
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`${plan.label}, ${subtitle(plan)}`}
            style={styles.cardPress}
          >
            <View style={archived ? styles.dim : null}>
              <MedicationGlyph appearance={plan.appearance} form={plan.form} size={48} />
            </View>
            <View style={styles.grow}>
              <Text numberOfLines={2} style={[typography.headline, styles.name, { color: c.textPrimary }]}>
                {plan.label}
              </Text>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>{subtitle(plan)}</Text>
              {meta ? (
                typeof meta === 'string' ? (
                  <Text style={[typography.subhead, styles.meta, { color: c.textTertiary }]}>{meta}</Text>
                ) : (
                  <View style={styles.meta}>{meta}</View>
                )
              ) : null}
            </View>
          </AnimatedPressable>
          {moreButton(plan, false)}
        </View>
      </View>
    );
  };

  const renderList = (rows: MedicationPlan[], offset: number) => (
    <View style={styles.list}>
      {rows.map((plan, index) => (
        <Animated.View
          key={plan.request.id}
          entering={firstLoad.current ? enter(offset + index) : FadeIn.duration(duration.base)}
          exiting={FadeOut.duration(duration.fast)}
          layout={reflow}
        >
          {isLow(plan) ? lowTile(plan) : card(plan)}
        </Animated.View>
      ))}
    </View>
  );

  // Low-supply medications float to the top of the active list.
  const activeSorted = [...activePlans.filter(isLow), ...activePlans.filter((plan) => !isLow(plan))];
  const onlyActive = pausedPlans.length === 0 && archivedPlans.length === 0;
  // ponytail: a long label ("Hinzufügen") beside the display title breaks the title on phones; the pill drops to its + then.
  const addLabel = t('addCta').length <= 6 ? t('addCta') : null;
  const lowCount = plans.plans.filter(isLow).length;
  const refillLine = lowCount ? t('refillsStripLow').replace('{count}', String(lowCount)) : t('refillsStripOk');

  return (
    <PageShell>
      <PageHeader
        title={t('medications')}
        action={
          <AnimatedPressable
            onPress={() => router.push('/medications/new')}
            haptic="light"
            scaleTo={0.96}
            accessibilityRole="button"
            accessibilityLabel={t('addMedication')}
            style={[styles.add, !addLabel && styles.addIconOnly, { backgroundColor: c.ink }]}
          >
            <View style={[styles.addDot, { backgroundColor: c.accentSoft }]}>
              <Ionicons name="add" size={20} color={INK} />
            </View>
            {addLabel ? <Text style={[typography.headline, { color: c.onInk, fontFamily: font.bold }]}>{addLabel}</Text> : null}
          </AnimatedPressable>
        }
      />

      <Stack>
        {plans.plans.length >= SEARCH_FROM ? (
          <View>
            <Input
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder={t('medsSearchPlaceholder')}
              returnKeyType="search"
              accessibilityLabel={t('medsSearchPlaceholder')}
              style={{ paddingRight: CLEAR_HIT }}
            />
            {searchTerm ? (
              <AnimatedPressable
                onPress={() => setSearchTerm('')}
                accessibilityRole="button"
                accessibilityLabel={t('medsSearchClear')}
                style={styles.clear}
              >
                <Ionicons name="close-circle" size={18} color={c.textTertiary} />
              </AnimatedPressable>
            ) : null}
          </View>
        ) : null}

        <View>
          {isLoading ? (
            <View style={styles.list}>
              {[0, 1, 2].map((i) => (
                <Card key={i}>
                  <SkeletonRow isFirst />
                </Card>
              ))}
            </View>
          ) : patient.error || plans.error ? (
            <ErrorState
              description={t('loadMedicationsError')}
              onRetry={() => {
                void patient.refetch();
                void plans.requestsQuery.refetch();
                void plans.medicationsQuery.refetch();
                void refreshSupply();
              }}
            />
          ) : plans.plans.length === 0 ? (
            <EmptyState
              title={t('noMedsYet')}
              description={t('addMedicationCadenceHint')}
              action={<Button label={t('addMedication')} onPress={() => router.push('/medications/new')} />}
            />
          ) : filteredPlans.length === 0 ? (
            <EmptyState title={t('noMedsMatchFilter')} description={t('addMedicationCadenceHint')} />
          ) : (
            <Stack>
              {activePlans.length > 0 && !searchTerm ? (
                <Animated.View entering={firstLoad.current ? enter(0) : undefined}>
                  <AnimatedPressable
                    onPress={() => router.push('/refills' as never)}
                    haptic="light"
                    scaleTo={0.98}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('refillsRouteTitle')}, ${refillLine}`}
                    style={[styles.card, styles.strip, { backgroundColor: c.surface, borderColor: c.cardBorder, borderWidth: isDark ? StyleSheet.hairlineWidth : 0 }]}
                  >
                    <View style={[styles.stripIcon, { backgroundColor: c.tones.butter.bg }]}>
                      <Ionicons name="bag-add-outline" size={20} color={INK} />
                    </View>
                    <View style={styles.grow}>
                      <Text style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>{t('refillsRouteTitle')}</Text>
                      <Text numberOfLines={1} style={[typography.subhead, { color: lowCount ? c.warning : c.textSecondary }]}>
                        {refillLine}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={c.textTertiary} />
                  </AnimatedPressable>
                </Animated.View>
              ) : null}

              {activePlans.length > 0 ? (
                <View>
                  {onlyActive ? null : <SectionHeader title={t('statusActive')} />}
                  {renderList(activeSorted, 0)}
                </View>
              ) : null}

              {pausedPlans.length > 0 ? (
                <View>
                  <SectionHeader title={t('statusPaused')} />
                  {renderList(pausedPlans, activePlans.length)}
                </View>
              ) : null}

              {archivedPlans.length > 0 ? (
                <Animated.View layout={reflow} style={{ gap: spacing(3) }}>
                  <Button
                    kind="outline"
                    label={t('archivedMedicationsCount').replace('{count}', String(archivedPlans.length))}
                    icon={<Ionicons name={showArchived ? 'chevron-up' : 'chevron-down'} size={16} color={c.textPrimary} />}
                    onPress={() => setShowArchived((open) => !open)}
                  />
                  {showArchived ? renderList(archivedPlans, activePlans.length + pausedPlans.length) : null}
                </Animated.View>
              ) : null}
            </Stack>
          )}
        </View>
      </Stack>

      <MedicationActionSheet
        plan={sheet?.plan ?? null}
        patientRef={patientRef}
        initialStep={sheet?.step ?? 'root'}
        onClose={() => setSheet(null)}
        onChanged={() => void refreshSupply()}
      />
    </PageShell>
  );
}

const styles = StyleSheet.create({
  addIconOnly: { paddingRight: spacing(2) },
  add: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingLeft: spacing(2),
    paddingRight: spacing(4),
    borderRadius: radius.full,
  },
  addDot: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  list: { gap: spacing(2.5) },
  card: { borderRadius: radius.xl, padding: spacing(4) },
  lowCard: { gap: spacing(3) },
  strip: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(3) },
  stripIcon: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  cardPress: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  glass: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1, minWidth: 0 },
  name: { fontFamily: font.bold },
  meta: { marginTop: 2, alignSelf: 'flex-start' },
  dim: { opacity: 0.55 },
  supplyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  more: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clear: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: CLEAR_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
