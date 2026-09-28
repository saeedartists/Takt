import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable, INK, PAPER, font, radius, typography } from '@/components/ui';
import type { WeekdayCode } from '@/lib/takt/types';

/*
 * WeekdayPicker — a row of day circles for the sky "When" tile: ink when
 * chosen, white glass when not, with a dot so the state never rests on
 * colour alone. Tiles stay light in dark mode, so colours are fixed.
 */
export const WeekdayPicker = ({
  days,
  selected,
  onToggle,
  labelFor,
}: {
  days: WeekdayCode[];
  selected: WeekdayCode[];
  onToggle: (day: WeekdayCode) => void;
  labelFor: (day: WeekdayCode) => string;
}) => (
  <View style={styles.wrap}>
    {days.map((day) => {
      const active = selected.includes(day);
      const label = labelFor(day);
      return (
        <AnimatedPressable
          key={day}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: active }}
          onPress={() => onToggle(day)}
          scaleTo={0.9}
          hitSlop={4}
          style={[styles.day, { backgroundColor: active ? INK : 'rgba(255,255,255,0.8)' }]}
        >
          <Text
            numberOfLines={1}
            style={[typography.footnote, { color: active ? PAPER : INK, fontFamily: active ? font.bold : font.semibold }]}
          >
            {label}
          </Text>
          {active ? <View style={styles.tick} /> : null}
        </AnimatedPressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Small paper dot under the label: a second, non-colour cue for "chosen".
  tick: { position: 'absolute', bottom: 7, width: 5, height: 5, borderRadius: radius.full, backgroundColor: PAPER },
});
