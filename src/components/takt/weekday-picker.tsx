import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, useTokens } from '@/components/ui';
import type { WeekdayCode } from '@/lib/takt/types';

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
}) => {
  const { c } = useTokens();

  return (
    <View style={styles.wrap}>
      {days.map((day) => {
        const active = selected.includes(day);
        const label = labelFor(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={() => onToggle(day)}
            style={({ pressed }) => [
              styles.day,
              {
                borderColor: active ? c.accent : c.separator,
                backgroundColor: active ? `${c.accent}22` : c.surfaceRaised,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Text style={[typography.subhead, { color: active ? c.accent : c.textSecondary }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  day: {
    minWidth: 54,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2.5),
  },
});
