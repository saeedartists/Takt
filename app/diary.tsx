import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  Card,
  EmptyState,
  PageHeader,
  PageShell,
  SectionHeader,
  SkeletonCard,
  Stack,
  font,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { DailyCheckInCard, MoodFace, MoodStrip, moodLabel, symptomLabel } from '@/components/takt/daily-check-in-card';
import { dateFromKey, sortedEntries, summarizeDiary, todayKey, useDiary, type Mood } from '@/lib/takt/diary';
import { useLocale } from '@/lib/takt/l10n';

/*
 * Diary — how the patient has felt: today's check-in, a 14-day mood
 * strip, the symptoms noted most often and every earlier entry (each
 * editable in place). All on-device.
 */
export default function DiaryScreen() {
  const { c } = useTokens();
  const { t, formatDate } = useLocale();
  const { enter } = useMotion();
  const diary = useDiary();

  const summary = useMemo(() => summarizeDiary(diary.map, 14), [diary.map]);
  const earlier = useMemo(() => sortedEntries(diary.map).filter((e) => e.date !== todayKey()), [diary.map]);
  const hasAny = Object.keys(diary.map).length > 0;
  const lilac = c.tones.lilac;

  if (diary.isLoading) {
    return (
      <PageShell>
        <SkeletonCard rows={3} />
      </PageShell>
    );
  }

  const first = summary.days[0];
  const avgMood = summary.average ? (Math.round(summary.average) as Mood) : null;

  return (
    <PageShell>
      <PageHeader subtitle={t('diaryPageLead')} />
      <Stack>
        <Animated.View entering={enter(0)}>
          <DailyCheckInCard showLink={false} />
        </Animated.View>

        {!hasAny ? (
          <Animated.View entering={enter(1)}>
            <EmptyState title={t('diaryEmptyTitle')} description={t('diaryEmptyBody')} />
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={enter(1)}>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text accessibilityRole="header" style={[typography.title3, styles.flex, { color: c.textPrimary }]}>
                    {t('diaryLast14')}
                  </Text>
                  <Text style={[typography.footnote, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>
                    {t('diaryDaysLogged').replace('{count}', String(summary.logged)).replace('{total}', '14')}
                  </Text>
                </View>
                <View
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={summary.days
                    .filter((d) => d.mood)
                    .map((d) => `${formatDate(dateFromKey(d.date), { day: 'numeric', month: 'short' })}: ${moodLabel(d.mood as Mood, t)}`)
                    .join(', ')}
                >
                  <MoodStrip days={summary.days} color={lilac.solid} track={c.separator} />
                </View>
                <View style={styles.row}>
                  <Text style={[typography.caption, styles.flex, { color: c.textTertiary }]}>
                    {first ? formatDate(dateFromKey(first.date), { day: 'numeric', month: 'short' }) : ''}
                  </Text>
                  <Text style={[typography.caption, { color: c.textTertiary }]}>{t('today')}</Text>
                </View>
                {avgMood && summary.average ? (
                  <View style={[styles.avg, { borderTopColor: c.separator }]}>
                    <View style={[styles.avgFace, { backgroundColor: lilac.bg }]}>
                      <MoodFace mood={avgMood} size={22} color="#15171C" />
                    </View>
                    <Text style={[typography.subhead, styles.flex, { color: c.textSecondary }]}>{t('diaryAverageMood')}</Text>
                    <Text style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>
                      {moodLabel(avgMood, t)}
                    </Text>
                  </View>
                ) : null}
              </Card>
            </Animated.View>

            {summary.topSymptoms.length > 0 ? (
              <Animated.View entering={enter(2)}>
                <Card style={styles.card}>
                  <Text accessibilityRole="header" style={[typography.title3, { color: c.textPrimary }]}>
                    {t('diaryMostOften')}
                  </Text>
                  {summary.topSymptoms.slice(0, 4).map((s) => (
                    <View key={s.code} style={styles.row}>
                      <Text style={[typography.callout, styles.flex, { color: c.textPrimary, fontFamily: font.semibold }]}>
                        {symptomLabel(s.code, t)}
                      </Text>
                      <View style={[styles.symTrack, { backgroundColor: c.surfaceRaised }]}>
                        <View style={[styles.symFill, { width: `${(s.days / 14) * 100}%`, backgroundColor: lilac.solid }]} />
                      </View>
                      <Text style={[typography.subhead, styles.count, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>
                        {s.days === 1 ? t('diarySymptomOneDay') : t('diarySymptomDays').replace('{count}', String(s.days))}
                      </Text>
                    </View>
                  ))}
                </Card>
              </Animated.View>
            ) : null}

            {earlier.length > 0 ? (
              <View>
                <SectionHeader title={t('diaryEarlier')} />
                <Card>
                  {earlier.slice(0, 60).map((entry, i) => (
                    <Animated.View
                      key={entry.date}
                      entering={enter(i + 3)}
                      style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator } : null}
                    >
                      <DailyCheckInCard date={entry.date} showLink={false} bare />
                    </Animated.View>
                  ))}
                </Card>
              </View>
            ) : null}
          </>
        )}
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing(4), gap: spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  flex: { flex: 1, minWidth: 0 },
  avg: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingTop: spacing(3), borderTopWidth: StyleSheet.hairlineWidth },
  avgFace: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  symTrack: { width: 72, height: 8, borderRadius: 4, overflow: 'hidden' },
  symFill: { height: '100%', borderRadius: 4 },
  count: { minWidth: 64, textAlign: 'right' },
});
