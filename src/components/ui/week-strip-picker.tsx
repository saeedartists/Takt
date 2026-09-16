import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTokens } from '@/theme/use-tokens';
import { addDays, isoDateKey, startOfDay } from '@/lib/takt/time';
import { AnimatedPressable } from './animated-pressable';

type DayAdherence = {
  total: number;
  taken: number;
  missed: number;
};

type WeekStripPickerProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  adherenceMap?: Record<string, DayAdherence>;
  todayLabel?: string;
};

const getStartOfWeek = (date: Date): Date => {
  const d = startOfDay(date);
  const day = d.getDay();
  // Monday is 1; Sunday is 0
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  const start = new Date(d);
  start.setDate(diff);
  return start;
};

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekStripPicker({
  selectedDate,
  onSelectDate,
  adherenceMap = {},
  todayLabel = 'Today',
}: WeekStripPickerProps) {
  const { c } = useTokens();
  const today = useMemo(() => startOfDay(new Date()), []);
  const selectedDayStart = useMemo(() => startOfDay(selectedDate), [selectedDate]);

  const weekDays = useMemo(() => {
    const start = getStartOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const key = isoDateKey(d);
      const isToday = isoDateKey(d) === isoDateKey(today);
      const isSelected = isoDateKey(d) === isoDateKey(selectedDayStart);
      const adherence = adherenceMap[key];
      const isFuture = d.getTime() > today.getTime();

      return {
        date: d,
        key,
        dayName: WEEKDAY_NAMES[i],
        dayNumber: d.getDate().toString(),
        isToday,
        isSelected,
        isFuture,
        adherence,
      };
    });
  }, [adherenceMap, selectedDate, selectedDayStart, today]);

  const monthYearLabel = useMemo(() => {
    return selectedDate.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDate]);

  const isCurrentDayToday = isoDateKey(selectedDate) === isoDateKey(today);

  return (
    <View style={[styles.container, { backgroundColor: c.surface, borderColor: c.cardBorder }]}>
      <View style={styles.headerRow}>
        <Text style={[typography.headline, { color: c.textPrimary }]}>{monthYearLabel}</Text>

        {!isCurrentDayToday ? (
          <AnimatedPressable
            onPress={() => onSelectDate(new Date())}
            style={[styles.todayButton, { backgroundColor: `${c.accent}1A`, borderColor: `${c.accent}33` }]}
          >
            <Ionicons name="calendar-outline" size={13} color={c.accent} />
            <Text style={[typography.caption, { color: c.accent, fontWeight: '700' }]}>{todayLabel}</Text>
          </AnimatedPressable>
        ) : null}
      </View>

      <View style={styles.stripRow}>
        {weekDays.map((item) => {
          let dotColor: string | null = null;
          if (item.adherence && item.adherence.total > 0) {
            if (item.adherence.taken === item.adherence.total) {
              dotColor = c.success;
            } else if (item.adherence.missed > 0) {
              dotColor = c.destructive;
            } else if (item.adherence.taken > 0) {
              dotColor = c.warning;
            }
          }

          return (
            <AnimatedPressable
              key={item.key}
              onPress={() => onSelectDate(item.date)}
              style={[
                styles.dayCell,
                item.isSelected
                  ? [styles.selectedCell, { backgroundColor: c.accent }]
                  : item.isToday
                    ? [styles.todayCell, { borderColor: `${c.accent}66`, backgroundColor: `${c.accent}0D` }]
                    : null,
              ]}
            >
              <Text
                style={[
                  typography.caption,
                  styles.dayLabel,
                  {
                    color: item.isSelected ? '#FFFFFF' : item.isToday ? c.accent : c.textSecondary,
                    fontWeight: item.isSelected || item.isToday ? '700' : '500',
                  },
                ]}
              >
                {item.dayName}
              </Text>

              <Text
                style={[
                  typography.subhead,
                  styles.numberLabel,
                  {
                    color: item.isSelected ? '#FFFFFF' : c.textPrimary,
                    fontWeight: item.isSelected ? '800' : '600',
                  },
                ]}
              >
                {item.dayNumber}
              </Text>

              <View style={styles.dotContainer}>
                {dotColor && !item.isSelected ? (
                  <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                ) : item.isToday && !item.isSelected ? (
                  <View style={[styles.todayIndicator, { backgroundColor: c.accent }]} />
                ) : (
                  <View style={styles.emptyDot} />
                )}
              </View>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    padding: spacing(3.5),
    borderWidth: 1,
    gap: spacing(3),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(1),
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(1),
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(2),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 3,
  },
  selectedCell: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  todayCell: {
    borderWidth: 1,
  },
  dayLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  numberLabel: {
    fontSize: 16,
  },
  dotContainer: {
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  todayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  emptyDot: {
    width: 5,
    height: 5,
  },
});
