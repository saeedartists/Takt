import { Ionicons } from '@expo/vector-icons';
import { Stack as RouterStack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition, ZoomIn } from 'react-native-reanimated';
import {
  AnimatedNumber,
  AnimatedPressable,
  AnimatedProgressBar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  INK,
  ListGroup,
  ListRow,
  PAPER,
  PageShell,
  SectionHeader,
  SkeletonCard,
  SkeletonRow,
  Stack,
  Tile,
  motion,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
  font,
} from '@/components/ui';
import {
  MedicationActionSheet,
  duplicateParams,
  pausedUntil,
  usePlanStatusUpdate,
  type SheetStep,
} from '@/components/takt/medication-action-sheet';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { TAKT_EXT } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { MedicationGlyph, glyphTint } from '@/components/takt/medication-glyph';
import { describeCadence, describeInstruction } from '@/lib/takt/medication-form';
import { buildHistory, parseDateOnly } from '@/lib/takt/schedule';
import { LOW_SUPPLY_THRESHOLD, getSupplySnapshot, type SupplySnapshot } from '@/lib/takt/supply-tracker';
import type { MedicationAdministrationResource, MedicationPlan } from '@/lib/takt/types';

const expand = LinearTransition.springify()
  .damping(motion.spring.gentle.damping)
  .stiffness(motion.spring.gentle.stiffness);

/** The tablet settles in: a small, unhurried scale from 85%, no overshoot. */
const heroGlyphIn = ZoomIn.springify()
  .damping(motion.spring.settle.damping)
  .stiffness(motion.spring.settle.stiffness)
  .withInitialValues({ transform: [{ scale: 0.85 }] });

const timeIcon = (time: string): 'sunny-outline' | 'partly-sunny-outline' | 'moon-outline' => {
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? 'sunny-outline' : hour < 18 ? 'partly-sunny-outline' : 'moon-outline';
};

const statusLabelKey = (status: string): 'statusActive' | 'statusPaused' | 'statusArchived' =>
  status === 'on-hold' ? 'statusPaused' : status === 'stopped' ? 'statusArchived' : 'statusActive';

const eventTimestamp = (event: MedicationAdministrationResource): string | undefined =>
  event.extension?.find((entry) => entry.url === TAKT_EXT.scheduledTime)?.valueDateTime ?? event.effectiveDateTime;

const eventState = (event: MedicationAdministrationResource): 'taken' | 'skipped' | 'missed' => {
  if (event.status === 'completed') return 'taken';
  return event.statusReason?.[0]?.coding?.[0]?.code === 'patient-refusal' ? 'skipped' : 'missed';
};

export default function MedicationDetailsScreen() {
  const { c, isDark } = useTokens();
  const { t, formatDate, formatTime } = useLocale();
  const { enter, reduce } = useMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const statusUpdate = usePlanStatusUpdate(patientRef);

  const plan = useMemo(() => plans.plans.find((entry) => entry.request.id === id), [id, plans.plans]);

  const [statusError, setStatusError] = useState<string | null>(null);
  /** undefined while loading, null when no count was ever set. */
  const [supply, setSupply] = useState<SupplySnapshot | null | undefined>(undefined);
  const [sheet, setSheet] = useState<SheetStep | null>(null);

  const reloadSupply = useCallback(async () => {
    const medicationId = plan?.medication?.id;
    setSupply(medicationId ? await getSupplySnapshot(medicationId) : null);
  }, [plan?.medication?.id]);

  useFocusEffect(
    useCallback(() => {
      void reloadSupply();
    }, [reloadSupply]),
  );

  // Recent logs, newest first.
  const recent = useMemo(() => {
    if (!plan) return [];
    return (events.data?.entry ?? [])
      .map((entry) => entry.resource)
      .filter((entry) => entry.request?.reference === `MedicationRequest/${plan.request.id}`)
      .map((event) => ({ event, at: new Date(eventTimestamp(event) ?? 0) }))
      .filter(({ at }) => !Number.isNaN(at.getTime()))
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 6);
  }, [events.data?.entry, plan]);

  // Share of scheduled doses taken over the last 14 days; as-needed plans have no schedule to keep.
  const adherence = useMemo(() => {
    if (!plan || plan.cadence === 'as-needed') return null;
    const days = buildHistory([plan], (events.data?.entry ?? []).map((entry) => entry.resource), 14);
    const taken = days.reduce((sum, day) => sum + day.taken, 0);
    const denominator = days.reduce((sum, day) => sum + day.taken + day.skipped + day.missed, 0);
    return { denominator, pct: denominator ? Math.round((taken / denominator) * 100) : 0 };
  }, [events.data?.entry, plan]);

  /** Resume and Restore are one tap; Pause and Archive go through the sheet because they ask a question. */
  const setActive = async (target: MedicationPlan) => {
    setStatusError(null);
    try {
      await statusUpdate.update(target, 'active');
    } catch {
      setStatusError(t('medicationStatusActionError'));
    }
  };

  const title = plan?.label ?? t('medicationDetailsRouteTitle');

  if (patient.isLoading || plans.isLoading || events.isLoading) {
    return (
      <PageShell>
        <RouterStack.Screen options={{ title }} />
        <Stack>
          <SkeletonCard rows={2} />
          <SkeletonCard rows={1} />
          <ListGroup>
            <SkeletonRow isFirst />
            <SkeletonRow />
            <SkeletonRow />
          </ListGroup>
        </Stack>
      </PageShell>
    );
  }

  if (patient.error || plans.error || events.error) {
    return (
      <PageShell>
        <RouterStack.Screen options={{ title }} />
        <ErrorState
          description={t('loadMedicationsError')}
          onRetry={() => {
            void patient.refetch();
            void plans.requestsQuery.refetch();
            void plans.medicationsQuery.refetch();
            void events.refetch();
            void reloadSupply();
          }}
        />
      </PageShell>
    );
  }

  if (!plan || !patientRef || !plan.medication) {
    return (
      <PageShell>
        <RouterStack.Screen options={{ title }} />
        <EmptyState title={t('medicationNotFound')} description={t('medicationNotFoundHint')} />
      </PageShell>
    );
  }

  const status = plan.request.status;
  const until = pausedUntil(plan);
  const cadenceText = describeCadence(plan, t);
  const instructionText = describeInstruction(plan, t);
  const courseEnd = parseDateOnly(plan.endDate);
  const low = Boolean(supply && supply.count <= LOW_SUPPLY_THRESHOLD);

  // The hero wears the tablet's own colour; without an appearance it falls back to the palette pastel.
  const heroBg = plan.appearance ? glyphTint(plan.appearance.color, isDark) : c.accentSoft;
  const heroInk = plan.appearance ? c.textPrimary : INK;
  const heroSub = plan.appearance ? c.textSecondary : c.onAccentSoft;
  const sky = c.tones.sky;
  const lilac = c.tones.lilac;
  const butter = c.tones.butter;

  return (
    <PageShell>
      <RouterStack.Screen options={{ title }} />

      <Stack>
        {/* Hero: what it is, in its own colour */}
        <Animated.View entering={enter(0)} layout={expand} style={[styles.hero, { backgroundColor: heroBg }]}>
          <Animated.View entering={reduce ? undefined : heroGlyphIn} style={styles.heroGlyph}>
            <MedicationGlyph appearance={plan.appearance} form={plan.form} size={72} />
          </Animated.View>
          <Badge
            label={
              until
                ? t('pausedUntil').replace('{date}', formatDate(until, { day: 'numeric', month: 'short' }))
                : t(statusLabelKey(status))
            }
            tone={status === 'active' ? 'success' : 'neutral'}
            icon={status === 'active' ? 'checkmark-circle' : status === 'on-hold' ? 'pause-circle' : 'archive'}
          />
          <View style={styles.heroText}>
            <Text style={[typography.title1, { color: heroInk }]} numberOfLines={2} accessibilityRole="header">
              {plan.label}
            </Text>
            <Text style={[typography.callout, styles.heroSub, { color: heroSub }]}>
              {[plan.form || t('formNotSet'), plan.strength].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Animated.View>

        {/* Schedule (sky): when */}
        <Animated.View entering={enter(1)} layout={expand}>
          <Tile tone="sky" style={styles.tileBody}>
            <View style={styles.spaceBetween}>
              <Text style={[typography.headline, { color: INK, fontFamily: font.bold }]}>{t('medicationCadence')}</Text>
              <Text style={[typography.callout, { color: sky.fg, fontFamily: font.semibold, flexShrink: 1, textAlign: 'right' }]}>
                {cadenceText}
              </Text>
            </View>
            {plan.cadence === 'as-needed' ? (
              <View style={{ gap: spacing(1) }}>
                {plan.maxPerDay ? (
                  <Text style={[typography.title3, { color: INK }]}>{t('asNeededUpTo').replace('{count}', String(plan.maxPerDay))}</Text>
                ) : null}
                <Text style={[typography.subhead, { color: sky.fg }]}>{t('asNeededHint')}</Text>
              </View>
            ) : (
              <View style={styles.wrapRow} accessibilityLabel={`${t('medicationTimes')}: ${plan.times.join(', ')}`}>
                {plan.times.map((time) => (
                  <View key={time} style={styles.timeChip}>
                    <Ionicons name={timeIcon(time)} size={18} color={sky.fg} />
                    <Text style={[typography.title3, styles.timeText]}>{time}</Text>
                  </View>
                ))}
              </View>
            )}
            {instructionText ? <Text style={[typography.body, { color: sky.fg }]}>{instructionText}</Text> : null}
            {courseEnd ? (
              <Text style={[typography.subhead, { color: sky.fg }]}>
                {t(status === 'stopped' ? 'courseEndedOn' : 'courseEndsOn').replace('{date}', formatDate(courseEnd, { day: 'numeric', month: 'long' }))}
              </Text>
            ) : null}
          </Tile>
        </Animated.View>

        {/* Adherence (lilac): only once there is something to measure */}
        {adherence && adherence.denominator > 0 ? (
          <Animated.View entering={enter(2)} layout={expand}>
            <Tile tone="lilac" style={styles.adherence}>
              <AnimatedNumber value={adherence.pct} suffix="%" style={[typography.metricSm, { color: INK }]} delay={200} />
              <View style={styles.grow}>
                <Text style={[typography.headline, { color: INK }]}>{t('takenOnSchedule')}</Text>
                <Text style={[typography.subhead, { color: lilac.fg }]}>{t('adherenceWindow')}</Text>
              </View>
            </Tile>
          </Animated.View>
        ) : null}

        {/* Supply (butter): how much is left, and the refill */}
        <Animated.View entering={enter(3)} layout={expand}>
          <Tile tone="butter" style={styles.tileBody}>
            <Text style={[typography.headline, { color: INK, fontFamily: font.bold }]}>{t('medicationSupplySectionTitle')}</Text>
            {supply ? (
              <>
                <View>
                  <View style={styles.spaceBetween}>
                    <AnimatedNumber value={supply.count} style={[typography.metricSm, { color: INK }]} delay={150} />
                    <View style={styles.glassPill}>
                      <Ionicons name={low ? 'alert-circle' : 'time-outline'} size={16} color={butter.fg} />
                      <Text style={[typography.subhead, { color: butter.fg, fontFamily: font.bold }]}>
                        {supply.count <= 0 ? t('supplyRefillNeeded') : t('supplyDaysLeft').replace('{days}', String(supply.daysUntilRefill))}
                      </Text>
                    </View>
                  </View>
                  <Text style={[typography.subhead, { color: butter.fg }]}>
                    {t('supplyRemaining').replace('{count}', String(supply.count))}
                  </Text>
                </View>
                <AnimatedProgressBar
                  progress={Math.max(0.02, Math.min(1, supply.count / supply.capacity))}
                  color={butter.fg}
                  backgroundColor="rgba(255,255,255,0.75)"
                  height={8}
                />
                <Text style={[typography.subhead, { color: butter.fg }]}>
                  {t('supplyLastRefilled')}:{' '}
                  {supply.lastRefilledAt
                    ? formatDate(new Date(supply.lastRefilledAt), { year: 'numeric', month: 'short', day: 'numeric' })
                    : '—'}
                </Text>
              </>
            ) : (
              <Text style={[typography.subhead, { color: butter.fg }]}>{t('medicationSupplyOptional')}</Text>
            )}
            {status !== 'stopped' ? (
              <Button
                onTone
                label={supply ? t('logRefillCta') : t('supplySet')}
                accessibilityLabel={t('logRefillCta')}
                icon={<Ionicons name="add-circle-outline" size={20} color={PAPER} />}
                onPress={() => setSheet('refill')}
              />
            ) : null}
          </Tile>
        </Animated.View>

        {/* Recent dose logs */}
        <Animated.View entering={enter(4)} layout={expand}>
          <SectionHeader title={t('recentDoseLogsTitle')} />
          {recent.length === 0 ? (
            <EmptyState title={t('noDoseLogsYetTitle')} description={t('noDoseLogsYetHint')} />
          ) : (
            <Card style={styles.recent}>
              {recent.map(({ event, at }, index) => {
                const state = eventState(event);
                const tone = state === 'taken' ? c.tones.sage : state === 'skipped' ? c.tones.butter : c.tones.rose;
                const label = state === 'taken' ? t('statusTaken') : state === 'skipped' ? t('statusSkipped') : t('statusMissed');
                const icon = state === 'taken' ? 'checkmark' : state === 'skipped' ? 'remove' : 'close';
                return (
                  <Animated.View
                    key={event.id}
                    entering={enter(5 + index)}
                    style={[styles.doseRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}
                  >
                    <View style={[styles.doseDot, { backgroundColor: tone.bg }]}>
                      <Ionicons name={icon} size={18} color={tone.fg} />
                    </View>
                    <View style={styles.grow}>
                      <Text style={[typography.headline, { color: c.textPrimary }]}>
                        {formatDate(at, { weekday: 'short', day: 'numeric', month: 'short' })} · {formatTime(at)}
                      </Text>
                      <Text style={[typography.subhead, { color: c.textSecondary }]}>{label}</Text>
                    </View>
                  </Animated.View>
                );
              })}
            </Card>
          )}
        </Animated.View>

        {/* Plan actions: edit, and pause / resume / restore */}
        <Animated.View entering={enter(5)} layout={expand} style={{ gap: spacing(2) }}>
          <View style={styles.actionRow}>
            <View style={styles.grow}>
              <Button
                kind="secondary"
                label={t('editPlanCta')}
                accessibilityLabel={t('editMedicationPlanCta')}
                icon={<Ionicons name="create-outline" size={18} color={c.textPrimary} />}
                onPress={() => router.push(`/medications/${plan.request.id}/edit`)}
                style={{ backgroundColor: c.surface }}
              />
            </View>
            {status === 'active' ? (
              <View style={styles.grow}>
                <Button
                  kind="outline"
                  label={t('pauseCta')}
                  accessibilityLabel={t('pauseMedicationCta')}
                  icon={<Ionicons name="pause" size={18} color={c.textPrimary} />}
                  onPress={() => setSheet('pause')}
                  disabled={statusUpdate.isPending}
                />
              </View>
            ) : null}
            {status === 'on-hold' ? (
              <View style={styles.grow}>
                <Button
                  label={t('resumeCta')}
                  accessibilityLabel={t('resumeMedicationCta')}
                  icon={<Ionicons name="play" size={18} color={c.onInk} />}
                  onPress={() => void setActive(plan)}
                  loading={statusUpdate.isPending}
                />
              </View>
            ) : null}
            {status === 'stopped' ? (
              <View style={styles.grow}>
                <Button
                  label={t('restoreCta')}
                  icon={<Ionicons name="refresh" size={18} color={c.onInk} />}
                  onPress={() => void setActive(plan)}
                  loading={statusUpdate.isPending}
                />
              </View>
            ) : null}
          </View>
          {statusError ? (
            <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>
              {statusError}
            </Text>
          ) : null}
        </Animated.View>

        {/* Footer: rarely used, destructive last */}
        <Animated.View entering={enter(6)} layout={expand}>
          <ListGroup>
            <ListRow
              isFirst
              title={t('duplicateCta')}
              subtitle={t('duplicateMedicationCta')}
              leading={<Ionicons name="copy-outline" size={20} color={c.textSecondary} />}
              onPress={() => router.push({ pathname: '/medications/new', params: duplicateParams(plan) } as never)}
            />
            {status !== 'stopped' ? (
              <AnimatedPressable
                onPress={() => setSheet('archive')}
                accessibilityRole="button"
                accessibilityLabel={t('archiveMedicationCta')}
                style={[styles.destructiveRow, { borderTopColor: c.separator }]}
              >
                <Ionicons name="archive-outline" size={20} color={c.destructive} />
                <Text style={[typography.body, { color: c.destructive, flex: 1 }]}>{t('archiveCta')}</Text>
              </AnimatedPressable>
            ) : null}
          </ListGroup>
        </Animated.View>
      </Stack>

      <MedicationActionSheet
        plan={sheet ? plan : null}
        patientRef={patientRef}
        initialStep={sheet ?? 'root'}
        onClose={() => setSheet(null)}
        onChanged={() => void reloadSupply()}
      />
    </PageShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xxl,
    padding: spacing(5),
    overflow: 'hidden',
    gap: spacing(3),
  },
  heroGlyph: { position: 'absolute', top: spacing(4), right: spacing(4) },
  heroText: { marginTop: spacing(4), paddingRight: 72 },
  heroSub: { marginTop: spacing(0.5) },
  tileBody: { gap: spacing(3), padding: spacing(4) },
  adherence: { flexDirection: 'row', alignItems: 'center', gap: spacing(4), padding: spacing(4) },
  grow: { flex: 1, minWidth: 0 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing(2.5) },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    minHeight: 44,
    paddingLeft: spacing(3),
    paddingRight: spacing(4),
    borderRadius: radius.full,
    backgroundColor: '#FFFFFF',
  },
  timeText: { color: INK, fontVariant: ['tabular-nums'] },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    minHeight: 32,
    paddingHorizontal: spacing(3),
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(3) },
  recent: { paddingHorizontal: spacing(4), paddingVertical: spacing(1) },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), minHeight: 56, paddingVertical: spacing(2) },
  doseDot: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing(2.5) },
  destructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    minHeight: 52,
    paddingHorizontal: spacing(4),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
