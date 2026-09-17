import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import {
  AnimatedPressable,
  MIN_TOUCH_TARGET,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';
import { isClockTime } from '@/lib/takt/medication-form';
import { atClockTime, isoDateKey } from '@/lib/takt/time';

export type TimeFieldProps = {
  mode: 'time' | 'date';
  /** HH:MM for `time`, YYYY-MM-DD for `date`, or '' when unset. */
  value: string;
  onChange: (next: string) => void;
  accessibilityLabel: string;
  invalid?: boolean;
  /** Open the picker as soon as the field mounts. */
  autoFocus?: boolean;
};

const pad = (n: number): string => n.toString().padStart(2, '0');

const toDate = (mode: TimeFieldProps['mode'], value: string): Date => {
  if (mode === 'time') return atClockTime(new Date(), isClockTime(value) ? value : '08:00');
  const parsed = value ? new Date(`${value}T12:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const fromDate = (mode: TimeFieldProps['mode'], date: Date): string =>
  mode === 'time' ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : isoDateKey(date);

/*
 * TimeField (native) — an Input-styled row that opens the system picker:
 * an inline spinner on iOS, the platform dialog on Android. Emits the
 * same strings as the web <input> so the form never sees a Date.
 */
export const TimeField = ({
  mode,
  value,
  onChange,
  accessibilityLabel,
  invalid = false,
  autoFocus = false,
}: TimeFieldProps) => {
  const { c, isDark } = useTokens();
  const { t, formatDate } = useLocale();
  const { duration } = useMotion();
  const [open, setOpen] = useState(autoFocus);

  const display =
    mode === 'time'
      ? value || t('selectTimeLabel')
      : value
        ? formatDate(toDate(mode, value), { year: 'numeric', month: 'short', day: 'numeric' })
        : t('dateNotSet');

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    // Android's dialog closes itself; unmount it or it re-opens on the next render.
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChange(fromDate(mode, date));
  };

  return (
    <Animated.View layout={LinearTransition} style={styles.wrap}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        accessibilityValue={{ text: display }}
        onPress={() => setOpen((prev) => !prev)}
        style={[
          styles.field,
          {
            backgroundColor: c.surface,
            borderColor: invalid ? c.destructive : open ? c.accent : c.separator,
          },
        ]}
      >
        <Text
          style={[
            typography.body,
            { color: value ? c.textPrimary : c.textTertiary, fontVariant: ['tabular-nums'] },
          ]}
        >
          {display}
        </Text>
        <Ionicons name={mode === 'time' ? 'time-outline' : 'calendar-outline'} size={18} color={c.textSecondary} />
      </AnimatedPressable>

      {open && Platform.OS === 'ios' ? (
        <Animated.View entering={FadeIn.duration(duration.fast)}>
          <DateTimePicker
            value={toDate(mode, value)}
            mode={mode}
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            onChange={handleChange}
          />
        </Animated.View>
      ) : null}
      {open && Platform.OS === 'android' ? (
        <DateTimePicker value={toDate(mode, value)} mode={mode} display="default" is24Hour onChange={handleChange} />
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing(2) },
  field: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(2),
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
  },
});
