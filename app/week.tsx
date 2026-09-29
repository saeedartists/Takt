import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  AnimatedNumber,
  Button,
  Card,
  EmptyState,
  ErrorState,
  INK,
  PageHeader,
  PageShell,
  ProgressRing,
  SkeletonCard,
  Stack,
  Tile,
  font,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
  type IconName,
} from '@/components/ui';
import { MedicationGlyph } from '@/components/takt/medication-glyph';
import { MoodFace, MoodStrip, moodLabel, symptomLabel } from '@/components/takt/daily-check-in-card';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { summarizeDiary, useDiary, type Mood } from '@/lib/takt/diary';
import { useLocale } from '@/lib/takt/l10n';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { buildHistory, type HistoryDay } from '@/lib/takt/schedule';
import { isoDateKey } from '@/lib/takt/time';

/*
 * Your week — a calm look back. Window rule: always the 7 days ending
 * today. The Sunday 18:00 notification therefore opens on Mon–Sun of the
 * week just ending; opened any other day it is simply the last 7 days.
 * Today's still-open doses are not counted (buildHistory leaves them
 * scheduled/due), so the evening's reminder never reads as "missed".
 * A record, not a grade: no scores, no blame (Calm UX guidelines).
 */
const DAYS = 7;

type Slot = 'morning' | 'midday' | 'evening' | 'night';
const SLOTS: Slot[] = ['morning', 'midday', 'evening', 'night'];
const SLOT_META: Record<Slot, { key: 'weekSlotMorning' | 'weekSlotMidday' | 'weekSlotEvening' | 'weekSlotNight'; icon: IconName }> = {
  morning: { key: 'weekSlotMorning', icon: 'sunny-outline' },
  midday: { key: 'weekSlotMidday', icon: 'partly-sunny-outline' },
  evening: { key: 'weekSlotEvening', icon: 'cloudy-night-outline' },
  night: { key: 'weekSlotNight', icon: 'moon-outline' },
};
// ponytail: fixed clock bands (05–11, 11–15, 15–20, 20–05); per-user day shape if patients ask.
const slotOf = (at: Date): Slot => {
  const h = at.getHours();
  return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 15 ? 'midday' : h >= 15 && h < 20 ? 'evening' : 'night';
};

type DayMark = 'all' | 'partly' | 'missed' | 'planned' | 'none';
// Same meaning as the History calendar: sage = all taken, butter = some, rose ring = a dose missed.
const dayMark = (day: HistoryDay): DayMark => {
  if (day.doses.length === 0) return 'none';
  if (day.missed > 0) return 'missed';
  if (day.taken === day.doses.length) return 'all';
  if (day.taken + day.skipped > 0) return 'partly';
  return 'planned';
};

export default function WeekScreen() {
  const { c } = useTokens();
  const { t, formatDate } = useLocale();
  const { enter } = useMotion();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const prefs = useReminderPreferences();
  const diary = useDiary();

  const days = useMemo(
    () =>
      buildHistory(plans.plans, (events.data?.entry ?? []).map((x) => x.resource), DAYS, {
        graceHours: prefs.data?.graceHours,
      }),
    [events.data?.entry, plans.plans, prefs.data?.graceHours],
  );

  const week = useMemo(() => {
    const doses = days.flatMap((day) => day.doses).filter((d) => d.state === 'taken' || d.state === 'skipped' || d.state === 'missed');
    const taken = doses.filter((d) => d.state === 'taken').length;
    const total = doses.length;

    const notTaken = new Map<Slot, number>();
    for (const d of doses) if (d.state !== 'taken') notTaken.set(slotOf(d.scheduledAt), (notTaken.get(slotOf(d.scheduledAt)) ?? 0) + 1);
    const hardest = SLOTS.reduce<{ slot: Slot; count: number } | null>((best, slot) => {
      const count = notTaken.get(slot) ?? 0;
      return count > (best?.count ?? 0) ? { slot, count } : best;
    }, null);

    const perMed = new Map<string, { taken: number; total: number }>();
    for (const d of doses) {
      const row = perMed.get(d.requestId) ?? { taken: 0, total: 0 };
      row.total += 1;
      if (d.state === 'taken') row.taken += 1;
      perMed.set(d.requestId, row);
    }
    const meds = plans.plans
      .filter((plan) => perMed.has(plan.request.id))
      .map((plan) => ({ plan, ...(perMed.get(plan.request.id) as { taken: number; total: number }) }));

    return { taken, total, pct: total ? Math.round((taken / total) * 100) : 0, hardest, meds };
  }, [days, plans.plans]);

  const mood = useMemo(() => summarizeDiary(diary.map, DAYS), [diary.map]);

  const isLoading = patient.isLoading || plans.isLoading || events.isLoading;
  const hasMeds = plans.plans.some((plan) => plan.request.status === 'active');
  const first = days[0]?.date;
  const range = first ? `${formatDate(first, { weekday: 'short', day: 'numeric', month: 'short' })} – ${t('today')}` : undefined;

  const verdict =
    week.total === 0
      ? t('weekVerdictNone')
      : week.taken === week.total
        ? t('weekVerdictAll')
        : week.pct >= 80
          ? t('weekVerdictSteady')
          : t('weekVerdictSome');
  const heroLine = t('weekHeroLine').replace('{taken}', String(week.taken)).replace('{total}', String(week.total));
  const lilac = c.tones.lilac;
  const avgMood = mood.average ? (Math.round(mood.average) as Mood) : null;
  const topSymptom = mood.topSymptoms[0];

  const dayLabel = (day: HistoryDay, mark: DayMark): string => {
    const at = formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' });
    const total = String(day.doses.length);
    const taken = String(day.taken);
    if (mark === 'all') return t('calendarDayAllTaken').replace('{date}', at).replace('{total}', total);
    if (mark === 'missed')
      return t('calendarDayMissed')
        .replace('{date}', at)
        .replace('{taken}', taken)
        .replace('{total}', total)
        .replace('{missed}', String(day.missed));
    if (mark === 'partly') return t('calendarDayPartly').replace('{date}', at).replace('{taken}', taken).replace('{total}', total);
    if (mark === 'planned') return t('calendarDayPlanned').replace('{date}', at).replace('{total}', total);
    return t('calendarDayNone').replace('{date}', at);
  };

  let i = 0;
  const next = () => enter(i++);

  return (
    <PageShell>
      {isLoading ? (
        <Stack>
          <SkeletonCard rows={2} />
          <SkeletonCard rows={1} />
          <SkeletonCard rows={2} />
        </Stack>
      ) : patient.error || plans.error || events.error ? (
        <ErrorState
          description={t('loadHistoryError')}
          onRetry={() => {
            void patient.refetch();
            void plans.requestsQuery.refetch();
            void plans.medicationsQuery.refetch();
            void events.refetch();
          }}
        />
      ) : !hasMeds ? (
        <EmptyState
          title={t('weekEmptyTitle')}
          description={t('weekEmptyHint')}
          action={<Button label={t('addMedication')} onPress={() => router.push('/medications/new')} />}
        />
      ) : (
        <>
          {range ? <PageHeader subtitle={range} /> : null}
          <Stack>
            {/* Insights hero: lilac. A plain count and a gentle line, no grading. */}
            <Animated.View entering={next()}>
              <Tile tone="lilac" style={styles.hero} accessibilityLabel={`${heroLine}, ${week.pct}%. ${verdict}`}>
                <View style={styles.heroText}>
                  <Text accessibilityRole="header" style={[typography.title2, styles.tabular, { color: INK }]}>
                    {heroLine}
                  </Text>
                  <Text style={[typography.body, { color: lilac.fg }]}>{verdict}</Text>
                </View>
                {week.total > 0 ? (
                  <ProgressRing progress={week.pct / 100} size={76} stroke={8} color={lilac.fg} track="rgba(255,255,255,0.7)">
                    <AnimatedNumber value={week.pct} suffix="%" style={[typography.headline, { color: INK, fontFamily: font.bold }]} />
                  </ProgressRing>
                ) : null}
              </Tile>
            </Animated.View>

            <Animated.View entering={next()}>
              <Card style={styles.card}>
                <Text accessibilityRole="header" style={[typography.title3, { color: c.textPrimary }]}>
                  {t('weekDayByDay')}
                </Text>
                <View style={styles.bars}>
                  {days.map((day, index) => {
                    const mark = dayMark(day);
                    const isToday = day.key === isoDateKey(new Date());
                    const fill = mark === 'all' ? c.tones.sage.bg : c.tones.butter.bg;
                    const share = day.doses.length ? day.taken / day.doses.length : 0;
                    return (
                      <Animated.View
                        key={day.key}
                        entering={enter(index + 1)}
                        accessible
                        accessibilityLabel={dayLabel(day, mark)}
                        style={styles.barCol}
                      >
                        <View
                          style={[
                            styles.track,
                            {
                              backgroundColor: c.surfaceRaised,
                              borderColor: mark === 'missed' ? c.tones.rose.solid : 'transparent',
                            },
                          ]}
                        >
                          {share > 0 ? (
                            <View style={[styles.fill, { height: `${Math.max(12, share * 100)}%`, backgroundColor: fill }]} />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            typography.caption,
                            {
                              color: isToday ? c.textPrimary : c.textTertiary,
                              fontFamily: isToday ? font.bold : font.medium,
                            },
                          ]}
                        >
                          {formatDate(day.date, { weekday: 'narrow' })}
                        </Text>
                      </Animated.View>
                    );
                  })}
                </View>
                <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  {[
                    { key: 'all', label: t('calendarAllTaken'), style: { backgroundColor: c.tones.sage.bg } },
                    { key: 'partly', label: t('calendarPartly'), style: { backgroundColor: c.tones.butter.bg } },
                    { key: 'missed', label: t('statusMissed'), style: { borderWidth: 2, borderColor: c.tones.rose.solid } },
                  ].map((item) => (
                    <View key={item.key} style={styles.legendItem}>
                      <View style={[styles.legendDot, item.style]} />
                      <Text style={[typography.caption, { color: c.textSecondary }]}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </Animated.View>

            {week.hardest ? (
              <Animated.View entering={next()}>
                <Card style={[styles.card, styles.row]}>
                  <View style={[styles.iconDot, { backgroundColor: c.tones.butter.bg }]}>
                    <Ionicons name={SLOT_META[week.hardest.slot].icon} size={22} color={c.tones.butter.fg} />
                  </View>
                  <View style={styles.grow}>
                    <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('weekHardestTitle')}</Text>
                    <Text style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>
                      {t(SLOT_META[week.hardest.slot].key)}
                    </Text>
                  </View>
                  <Text style={[typography.subhead, styles.tabular, { color: c.textSecondary }]}>
                    {t('weekNotTaken').replace('{count}', String(week.hardest.count))}
                  </Text>
                </Card>
              </Animated.View>
            ) : null}

            {week.meds.length > 0 ? (
              <Animated.View entering={next()}>
                <Card style={styles.list}>
                  {week.meds.map(({ plan, taken, total }, index) => (
                    <View
                      key={plan.request.id}
                      accessible
                      accessibilityLabel={t('weekMedA11y')
                        .replace('{name}', plan.label)
                        .replace('{taken}', String(taken))
                        .replace('{total}', String(total))}
                      style={[
                        styles.medRow,
                        index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
                      ]}
                    >
                      <MedicationGlyph appearance={plan.appearance} form={plan.form} size={40} />
                      <Text numberOfLines={2} style={[typography.headline, styles.grow, { color: c.textPrimary, fontFamily: font.bold }]}>
                        {plan.label}
                      </Text>
                      <Text style={[typography.headline, styles.tabular, { color: taken < total ? c.textPrimary : c.textSecondary }]}>
                        {`${taken}/${total}`}
                      </Text>
                    </View>
                  ))}
                </Card>
              </Animated.View>
            ) : null}

            {mood.logged > 0 && avgMood ? (
              <Animated.View entering={next()}>
                <Card style={styles.card}>
                  <Text accessibilityRole="header" style={[typography.title3, { color: c.textPrimary }]}>
                    {t('reportDiaryTitle')}
                  </Text>
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <MoodStrip days={mood.days} color={lilac.solid} track={c.separator} height={44} />
                  </View>
                  <View style={styles.row}>
                    <View style={[styles.face, { backgroundColor: lilac.bg }]}>
                      <MoodFace mood={avgMood} size={22} color={INK} />
                    </View>
                    <Text style={[typography.subhead, styles.grow, { color: c.textSecondary }]}>{t('diaryAverageMood')}</Text>
                    <Text style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>{moodLabel(avgMood, t)}</Text>
                  </View>
                  {topSymptom ? (
                    <View style={styles.row}>
                      <View style={[styles.face, { backgroundColor: c.surfaceRaised }]}>
                        <Ionicons name="pulse-outline" size={18} color={c.textSecondary} />
                      </View>
                      <Text style={[typography.subhead, styles.grow, { color: c.textSecondary }]}>{t('diaryMostOften')}</Text>
                      <Text style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>
                        {`${symptomLabel(topSymptom.code, t)} · ${
                          topSymptom.days === 1 ? t('diarySymptomOneDay') : t('diarySymptomDays').replace('{count}', String(topSymptom.days))
                        }`}
                      </Text>
                    </View>
                  ) : null}
                </Card>
              </Animated.View>
            ) : null}

            <Animated.View entering={next()} style={styles.actions}>
              <Button
                label={t('openReport')}
                accentIcon="document-text-outline"
                onPress={() => router.push('/report')}
              />
              <Button
                kind="secondary"
                label={t('weekSeeHistory')}
                icon={<Ionicons name="calendar-outline" size={20} color={c.textPrimary} />}
                onPress={() => router.push('/history')}
                style={{ backgroundColor: c.surface }}
              />
            </Animated.View>
          </Stack>
        </>
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), padding: spacing(5), borderRadius: radius.xxl },
  heroText: { flex: 1, minWidth: 0, gap: spacing(1) },
  card: { padding: spacing(4), gap: spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  grow: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  bars: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(1.5) },
  barCol: { flex: 1, alignItems: 'center', gap: spacing(1.5) },
  track: {
    width: '100%',
    maxWidth: 32,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: { width: '100%' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing(4), rowGap: spacing(1.5) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  iconDot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing(4) },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(3), minHeight: 56 },
  face: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: spacing(2.5) },
});
