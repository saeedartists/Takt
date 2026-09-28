import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { font, radius, spacing, typography } from '@/theme/tokens';
import { useMotion } from '@/theme/use-motion';
import { useTokens } from '@/theme/use-tokens';
import { useLocale } from '@/lib/takt/l10n';
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

export function WeekStripPicker({
  selectedDate,
  onSelectDate,
  adherenceMap = {},
  todayLabel = 'Today',
}: WeekStripPickerProps) {
  const { c, isDark } = useTokens();
  const { spring, reduce } = useMotion();
  // The selected pill is ink in light mode and paper in dark; its accent text follows suit.
  const onPill = isDark ? c.onAccentSoft : c.accentSoft;
  const { locale } = useLocale();
  // App locale, not device locale: "both languages complete on every reachable screen".
  const tag = locale === 'de' ? 'de-DE' : 'en-US';
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
        dayName: d.toLocaleDateString(tag, { weekday: 'short' }).replace('.', ''),
        dayNumber: d.getDate().toString(),
        isToday: key === isoDateKey(today),
        isSelected: key === selectedKey,
        adherence: adherenceMap[key],
      };
    });
  }, [adherenceMap, selectedDate, selectedKey, tag, today]);

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
    () => selectedDate.toLocaleDateString(tag, { month: 'long', year: 'numeric' }),
    [selectedDate, tag],
  );
  const isCurrentDayToday = selectedKey === isoDateKey(today);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[typography.subhead, { color: c.textSecondary, fontFamily: font.semibold }]}>{monthYearLabel}</Text>

        {!isCurrentDayToday ? (
          <Animated.View entering={reduce ? undefined : FadeIn.duration(180)} exiting={reduce ? undefined : FadeOut.duration(120)}>
            <AnimatedPressable
              onPress={() => onSelectDate(new Date())}
              accessibilityRole="button"
              accessibilityLabel={todayLabel}
              hitSlop={8}
              style={[styles.todayButton, { backgroundColor: c.accentSoft }]}
            >
              <Ionicons name="return-down-back" size={15} color={c.onAccentSoft} />
              <Text style={[typography.subhead, { color: c.onAccentSoft, fontFamily: font.bold }]}>{todayLabel}</Text>
            </AnimatedPressable>
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.stripRow}>
        {/* Layering: white day pills, then the sliding ink pill, then the labels on top. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.stripRow]}>
          {weekDays.map((item) => (
            <View
              key={item.key}
              style={[
                styles.dayBackdrop,
                { backgroundColor: item.date.getTime() <= today.getTime() ? c.surface : 'transparent' },
              ]}
            />
          ))}
        </View>
        <Animated.View pointerEvents="none" style={[styles.pill, { backgroundColor: c.ink }, pillStyle]} />
        {weekDays.map((item) => {
          // Filled sage = every dose taken, rose ring = a missed dose, butter = partly done.
          let mark: { color: string; ring: boolean } | null = null;
          if (item.adherence && item.adherence.total > 0) {
            if (item.adherence.taken === item.adherence.total) {
              mark = { color: c.tones.sage.solid, ring: false };
            } else if (item.adherence.missed > 0) {
              mark = { color: c.tones.rose.solid, ring: true };
            } else if (item.adherence.taken > 0) {
              mark = { color: c.tones.butter.solid, ring: false };
            }
          }
          const isPast = item.date.getTime() <= today.getTime();
          const dayLabel = item.date.toLocaleDateString(tag, {
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
              scaleTo={0.92}
              style={[
                styles.dayCell,
                item.isToday && !item.isSelected && { borderColor: c.textPrimary },
              ]}
            >
              <Text
                style={[
                  typography.caption,
                  styles.dayLabel,
                  {
                    color: item.isSelected ? onPill : c.textSecondary,
                    fontFamily: item.isSelected || item.isToday ? font.bold : font.semibold,
                  },
                ]}
              >
                {item.dayName}
              </Text>

              <Text
                style={[
                  typography.title3,
                  styles.numberLabel,
                  { color: item.isSelected ? c.onInk : isPast ? c.textPrimary : c.textSecondary },
                ]}
              >
                {item.dayNumber}
              </Text>

              <View style={styles.dotContainer}>
                {mark ? (
                  <View
                    style={[
                      styles.statusDot,
                      mark.ring
                        ? { borderWidth: 1.5, borderColor: item.isSelected ? c.onInk : mark.color }
                        : { backgroundColor: item.isSelected ? onPill : mark.color },
                    ]}
                  />
                ) : item.isToday ? (
                  <View style={[styles.statusDot, { backgroundColor: item.isSelected ? onPill : c.textPrimary }]} />
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
    gap: spacing(3),
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
    gap: spacing(1.5),
    minHeight: 36,
    paddingHorizontal: spacing(3.5),
    borderRadius: radius.full,
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
    borderRadius: radius.full,
  },
  dayCell: {
    flex: 1,
    height: 76,
    maxWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 1,
  },
  dayLabel: {
    paddingHorizontal: spacing(0.5),
  },
  numberLabel: {
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
  },
  dotContainer: {
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dayBackdrop: { flex: 1, height: 76, maxWidth: 52, borderRadius: radius.full },
  todayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
