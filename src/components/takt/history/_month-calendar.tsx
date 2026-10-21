import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { StyleSheet, Text, View } from 'react-native';

import {
  AnimatedPressable,
  Card,
  font,
  INK,
  radius,
  spacing,
  typography,
  useMotion,
} from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';
import { addDays, isoDateKey } from '@/lib/takt/time';
import type { HistoryDay } from '@/lib/takt/schedule';
import { useTokens } from '@/theme/use-tokens';

type DayMark = 'all' | 'partly' | 'missed' | 'planned' | 'none' | 'future';

const dayMark = (day: HistoryDay | undefined): DayMark => {
  if (!day) return 'future';
  if (day.doses.length === 0) return 'none';
  if (day.missed > 0) return 'missed';
  if (day.taken === day.doses.length) return 'all';
  if (day.taken + day.skipped > 0) return 'partly';
  return 'planned';
};

// Any Monday: the weekday header runs Monday to Sunday in the user's language.
const MONDAY = new Date(2024, 0, 1);

/*
 * Month grid: sage = every dose taken, butter = some, rose ring = a dose
 * was missed, ink ring = today, faint = still ahead. Each day says the
 * same in words for screen readers; the legend spells it out on screen.
 */
export const MonthCalendar = ({
  month,
  days,
  dir,
  onShift,
  onOpenDay,
}: {
  month: Date;
  days: HistoryDay[];
  dir: -1 | 0 | 1;
  onShift: (dir: -1 | 1) => void;
  onOpenDay: (day: HistoryDay) => void;
}) => {
  const { c } = useTokens();
  const { t, formatDate } = useLocale();
  const { reduce, duration } = useMotion();
  const todayKey = isoDateKey(new Date());
  const now = new Date();
  const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const lead = (month.getDay() + 6) % 7;
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const slide = reduce || dir === 0 ? undefined : (dir > 0 ? FadeInRight : FadeInLeft).duration(duration.slow);

  const label = (date: Date, day: HistoryDay | undefined, mark: DayMark): string => {
    const name = formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' });
    const at = isoDateKey(date) === todayKey ? `${t('today')}, ${name}` : name;
    const total = String(day?.doses.length ?? 0);
    const taken = String(day?.taken ?? 0);
    if (mark === 'all') return t('calendarDayAllTaken').replace('{date}', at).replace('{total}', total);
    if (mark === 'missed')
      return t('calendarDayMissed')
        .replace('{date}', at)
        .replace('{taken}', taken)
        .replace('{total}', total)
        .replace('{missed}', String(day?.missed ?? 0));
    if (mark === 'partly') return t('calendarDayPartly').replace('{date}', at).replace('{taken}', taken).replace('{total}', total);
    if (mark === 'planned') return t('calendarDayPlanned').replace('{date}', at).replace('{total}', total);
    return t('calendarDayNone').replace('{date}', at);
  };

  const arrow = (to: -1 | 1) => {
    const enabled = to < 0 || !isCurrent;
    return (
      <AnimatedPressable
        onPress={() => onShift(to)}
        disabled={!enabled}
        haptic="light"
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel={t(to < 0 ? 'calendarPrevMonth' : 'calendarNextMonth')}
        accessibilityState={{ disabled: !enabled }}
        style={[styles.monthArrow, { backgroundColor: c.surfaceRaised, opacity: enabled ? 1 : 0.35 }]}
      >
        <Ionicons name={to < 0 ? 'chevron-back' : 'chevron-forward'} size={20} color={c.textPrimary} />
      </AnimatedPressable>
    );
  };

  const legend = [
    { key: 'all', label: t('calendarAllTaken'), style: { backgroundColor: c.tones.sage.bg } },
    { key: 'partly', label: t('calendarPartly'), style: { backgroundColor: c.tones.butter.bg } },
    { key: 'missed', label: t('statusMissed'), style: { borderWidth: 2, borderColor: c.tones.rose.solid } },
  ];

  return (
    <Card style={styles.calendar}>
      <View style={styles.monthHead}>
        <Text accessibilityRole="header" style={[typography.title3, { color: c.textPrimary, flex: 1 }]}>
          {formatDate(month, { month: 'long', year: 'numeric' })}
        </Text>
        {arrow(-1)}
        {arrow(1)}
      </View>

      <View style={styles.weekRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} style={[typography.caption, styles.weekday, { color: c.textTertiary }]}>
            {formatDate(addDays(MONDAY, i), { weekday: 'narrow' })}
          </Text>
        ))}
      </View>

      <Animated.View key={isoDateKey(month)} entering={slide} style={styles.grid}>
        {cells.map((dayOfMonth, index) => {
          if (dayOfMonth === null) return <View key={`blank-${index}`} style={styles.dayCell} />;
          const date = new Date(month.getFullYear(), month.getMonth(), dayOfMonth);
          const day = days[dayOfMonth - 1];
          const mark = dayMark(day);
          const isToday = isoDateKey(date) === todayKey;
          const fill = mark === 'all' ? c.tones.sage.bg : mark === 'partly' ? c.tones.butter.bg : 'transparent';
          const ring = mark === 'missed' ? c.tones.rose.solid : isToday ? c.textPrimary : 'transparent';
          const onTone = mark === 'all' || mark === 'partly';
          const text =
            mark === 'future' ? c.textTertiary : onTone ? INK : mark === 'none' ? c.textSecondary : c.textPrimary;
          const circle = (
            <View style={[styles.dayCircle, { backgroundColor: fill, borderColor: ring }]}>
              <Text
                style={[
                  typography.subhead,
                  styles.dayNumber,
                  { color: text, fontFamily: isToday || onTone || mark === 'missed' ? font.bold : font.medium },
                  mark === 'future' && styles.future,
                ]}
              >
                {dayOfMonth}
              </Text>
            </View>
          );
          if (!day || day.doses.length === 0) {
            return (
              <View key={dayOfMonth} style={styles.dayCell} accessible accessibilityLabel={label(date, day, mark)}>
                {circle}
              </View>
            );
          }
          return (
            <AnimatedPressable
              key={dayOfMonth}
              onPress={() => onOpenDay(day)}
              scaleTo={0.88}
              accessibilityRole="button"
              accessibilityLabel={label(date, day, mark)}
              accessibilityHint={t('calendarDayHint')}
              style={styles.dayCell}
            >
              {circle}
            </AnimatedPressable>
          );
        })}
      </Animated.View>

      <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {legend.map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.legendDot, item.style]} />
            <Text style={[typography.caption, { color: c.textSecondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  calendar: { padding: spacing(4), gap: spacing(2) },
  monthHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingLeft: spacing(1) },
  monthArrow: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontVariant: ['tabular-nums'] as const },
  future: { opacity: 0.55 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing(4), rowGap: spacing(1.5), paddingHorizontal: spacing(1), paddingTop: spacing(1) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
});
