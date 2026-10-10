import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  AnimatedPressable,
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

const ROW = 44;
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));

/** One snapping column of the Android time wheel; ticks like the iOS one as it turns. */
const WheelColumn = ({ items, index, onPick, label }: { items: string[]; index: number; onPick: (i: number) => void; label: string }) => {
  const { c } = useTokens();
  const ref = useRef<ScrollView>(null);
  const [live, setLive] = useState(index);
  const clamp = (y: number) => Math.min(items.length - 1, Math.max(0, Math.round(y / ROW)));

  return (
    <ScrollView
      ref={ref}
      accessibilityLabel={label}
      accessibilityValue={{ text: items[live] }}
      style={styles.column}
      contentContainerStyle={{ paddingVertical: ROW * 2 }}
      onLayout={() => ref.current?.scrollTo({ y: index * ROW, animated: false })}
      snapToInterval={ROW}
      decelerationRate="fast"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(e) => {
        const next = clamp(e.nativeEvent.contentOffset.y);
        if (next === live) return;
        setLive(next);
        // Emit on every tick: Android does not reliably fire a final scroll-end event after snapping.
        onPick(next);
        Haptics.selectionAsync().catch(() => undefined);
      }}
    >
      {items.map((item, i) => (
        <Pressable
          key={item}
          onPress={() => {
            ref.current?.scrollTo({ y: i * ROW, animated: true });
            onPick(i);
          }}
          style={styles.row}
        >
          <Text
            style={[
              typography.title3,
              { fontVariant: ['tabular-nums'], color: i === live ? c.textPrimary : c.textTertiary, opacity: Math.abs(i - live) > 1 ? 0.5 : 1 },
            ]}
          >
            {item}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};

/** Inline 24-hour wheel for Android, in place of the clock-face dialog. */
const TimeWheel = ({ value, onChange }: { value: string; onChange: (next: string) => void }) => {
  const { c } = useTokens();
  const { t } = useLocale();
  const [hh, mm] = (isClockTime(value) ? value : '08:00').split(':').map(Number);
  return (
    <View style={styles.wheelRow}>
      <View pointerEvents="none" style={[styles.band, { backgroundColor: c.surfaceRaised }]} />
      <WheelColumn items={HOURS} index={hh} label={t('selectTimeLabel')} onPick={(i) => onChange(`${HOURS[i]}:${pad(mm)}`)} />
      <Text style={[typography.title3, { color: c.textPrimary }]}>:</Text>
      <WheelColumn items={MINUTES} index={mm} label={t('selectTimeLabel')} onPick={(i) => onChange(`${pad(hh)}:${MINUTES[i]}`)} />
    </View>
  );
};

/*
 * TimeField (native) — an Input-styled row that opens the system picker:
 * an inline spinner on iOS, the same kind of inline wheel on Android for
 * times (the clock-face dialog felt foreign), and the calendar dialog for dates. Emits the
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
            borderColor: invalid ? c.destructive : open ? c.textPrimary : c.separator,
            borderWidth: open || invalid ? 2 : 1.5,
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
        <Ionicons name={mode === 'time' ? 'time-outline' : 'calendar-outline'} size={20} color={c.textSecondary} />
      </AnimatedPressable>

      {open && Platform.OS === 'ios' ? (
        // The iOS wheel (it ticks as it turns) sits on its own card so it keeps contrast on any tile.
        <Animated.View
          entering={FadeInDown.duration(duration.base)}
          exiting={FadeOut.duration(duration.fast)}
          style={[styles.wheelCard, { backgroundColor: c.surface }]}
        >
          <DateTimePicker
            value={toDate(mode, value)}
            mode={mode}
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            textColor={c.textPrimary}
            onChange={handleChange}
            style={styles.wheel}
          />
        </Animated.View>
      ) : null}
      {open && Platform.OS === 'android' && mode === 'time' ? (
        <Animated.View
          entering={FadeInDown.duration(duration.base)}
          exiting={FadeOut.duration(duration.fast)}
          style={[styles.wheelCard, { backgroundColor: c.surface }]}
        >
          <TimeWheel value={value} onChange={onChange} />
        </Animated.View>
      ) : null}
      {open && Platform.OS === 'android' && mode === 'date' ? (
        <DateTimePicker value={toDate(mode, value)} mode={mode} display="default" onChange={handleChange} />
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing(2) },
  wheelCard: { borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center' },
  wheel: { alignSelf: 'stretch' },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(2), height: ROW * 5 },
  column: { width: 72, height: ROW * 5 },
  row: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', left: spacing(3), right: spacing(3), top: ROW * 2, height: ROW, borderRadius: radius.md },
  field: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(2),
    borderRadius: radius.md,
    paddingHorizontal: spacing(4.5),
  },
});
