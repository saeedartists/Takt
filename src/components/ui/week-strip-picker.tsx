import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { radius, spacing, typography } from '@/theme/tokens';
import { useMotion } from '@/theme/use-motion';
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
  const { spring } = useMotion();
  const today = useMemo(() => startOfDay(new Date()), []);
  const selectedKey = isoDateKey(selectedDate);

  const weekDays = useMemo(() => {
    const start = getStartOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const key = isoDateKey(d);
      return {
        date: d,
        key,
        dayName: WEEKDAY_NAMES[i],
        dayNumber: d.getDate().toString(),
        isToday: key === isoDateKey(today),
        isSelected: key === selectedKey,
        adherence: adherenceMap[key],
      };
    });
  }, [adherenceMap, selectedDate, selectedKey, today]);

  // Selected pill slides between measured cell positions instead of re-rendering per cell.
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);

  const moveTo = (key: string, animate: boolean) => {
    const l = layouts.current[key];
    if (!l) return;
    if (!animate || pillW.value === 0) {
      pillX.value = l.x;
      pillW.value = l.width;
      return;
    }
    pillX.value = withSpring(l.x, spring.gentle);
    pillW.value = withSpring(l.width, spring.gentle);
  };

  useEffect(() => {
    moveTo(selectedKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const onCellLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layouts.current[key] = { x, width };
    if (key === selectedKey) moveTo(key, false);
  };

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
    opacity: pillW.value > 0 ? 1 : 0,
  }));

  const monthYearLabel = useMemo(
    () => selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [selectedDate],
  );
  const isCurrentDayToday = selectedKey === isoDateKey(today);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[typography.subhead, { color: c.textSecondary, fontWeight: '600' }]}>{monthYearLabel}</Text>

        {!isCurrentDayToday ? (
          <AnimatedPressable
            onPress={() => onSelectDate(new Date())}
            accessibilityRole="button"
            accessibilityLabel={todayLabel}
            hitSlop={8}
            style={[styles.todayButton, { backgroundColor: `${c.accent}1A`, borderColor: `${c.accent}33` }]}
          >
            <Ionicons name="calendar-outline" size={13} color={c.accent} />
            <Text style={[typography.caption, { color: c.accent, fontWeight: '700' }]}>{todayLabel}</Text>
          </AnimatedPressable>
        ) : null}
      </View>

      <View style={styles.stripRow}>
        <Animated.View pointerEvents="none" style={[styles.pill, { backgroundColor: c.accent }, pillStyle]} />
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
          const dayLabel = item.date.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          });

          return (
            <AnimatedPressable
              key={item.key}
              onLayout={onCellLayout(item.key)}
              onPress={() => onSelectDate(item.date)}
              accessibilityRole="button"
              accessibilityLabel={item.isToday ? `${todayLabel}, ${dayLabel}` : dayLabel}
              accessibilityState={{ selected: item.isSelected }}
              style={[
                styles.dayCell,
                item.isToday && !item.isSelected && { borderColor: `${c.accent}66` },
              ]}
            >
              <Text
                style={[
                  typography.overline,
                  styles.dayLabel,
                  {
                    color: item.isSelected ? c.surface : item.isToday ? c.accent : c.textSecondary,
                    fontWeight: item.isSelected || item.isToday ? '700' : '500',
                  },
                ]}
              >
                {item.dayName}
              </Text>

              <Text
                style={[
                  typography.callout,
                  styles.numberLabel,
                  {
                    color: item.isSelected ? c.surface : c.textPrimary,
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
                ) : null}
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
    gap: spacing(2),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(1),
    minHeight: 28,
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
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.md,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(1.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 2,
  },
  dayLabel: {
    paddingHorizontal: spacing(0.5),
  },
  numberLabel: {
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
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
});
