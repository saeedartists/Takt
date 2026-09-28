import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  AnimatedPressable,
  Button,
  Card,
  INK,
  Input,
  font,
  motion,
  radius,
  spacing,
  triggerHaptic,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { MOODS, SYMPTOM_CODES, dateFromKey, todayKey, useDiary, type Mood, type SymptomCode } from '@/lib/takt/diary';
import { useLocale } from '@/lib/takt/l10n';

type T = ReturnType<typeof useLocale>['t'];

const SYMPTOM_KEYS = {
  dizzy: 'diarySymptomDizzy',
  nausea: 'diarySymptomNausea',
  headache: 'diarySymptomHeadache',
  tired: 'diarySymptomTired',
  pain: 'diarySymptomPain',
  'poor-sleep': 'diarySymptomPoorSleep',
  'low-appetite': 'diarySymptomLowAppetite',
  other: 'diarySymptomOther',
} as const satisfies Record<SymptomCode, Parameters<T>[0]>;

export const moodLabel = (mood: Mood, t: T): string => t(`diaryMood${mood}` as Parameters<T>[0]);
export const symptomLabel = (code: SymptomCode, t: T): string => t(SYMPTOM_KEYS[code]);

/** "Good · Headache, Tired" */
export const entrySummary = (mood: Mood, symptoms: SymptomCode[], t: T): string =>
  [moodLabel(mood, t), symptoms.map((s) => symptomLabel(s, t)).join(', ')].filter(Boolean).join(' · ');

/*
 * MoodFace — a simple line face. The mouth bends from a frown (1) to a
 * wide smile (5); the brows only appear on the lowest mood.
 */
export const MoodFace = ({ mood, size = 30, color }: { mood: Mood; size?: number; color: string }) => {
  const bend = [0, -7, -3.5, 0, 4, 0][mood]; // control-point offset: frown … smile
  const y = 20.5 - bend / 3;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx={16} cy={16} r={13.5} stroke={color} strokeWidth={2} fill="none" />
      <Circle cx={11.5} cy={13} r={1.7} fill={color} />
      <Circle cx={20.5} cy={13} r={1.7} fill={color} />
      {mood === 1 ? (
        <Path d="M8.5 9.5 L13 8 M23.5 9.5 L19 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      ) : null}
      {mood === 5 ? (
        <Path d="M9.5 18 Q16 18.8 22.5 18 Q21 25 16 25 Q11 25 9.5 18 Z" fill={color} />
      ) : (
        <Path
          d={`M10.5 ${y} Q16 ${y + bend} 21.5 ${y}`}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </Svg>
  );
};

/*
 * MoodStrip — one bar per day, height and shade by mood (so it never
 * relies on colour alone); an empty day is a small hollow dot. Bars
 * grow in with a staggered, no-overshoot spring.
 */
export const MoodStrip = ({
  days,
  color,
  track,
  height = 64,
}: {
  days: { date: string; mood: Mood | null }[];
  /** Pass tone.solid on the page/card, tone.fg on a pastel tile. */
  color: string;
  track: string;
  height?: number;
}) => {
  const gap = days.length > 20 ? 2 : 4;
  return (
    <View style={[styles.strip, { height, gap }]}>
      {days.map((day, i) => (
        <StripBar key={day.date} mood={day.mood} index={i} color={color} track={track} height={height} />
      ))}
    </View>
  );
};

const StripBar = ({
  mood,
  index,
  color,
  track,
  height,
}: {
  mood: Mood | null;
  index: number;
  color: string;
  track: string;
  height: number;
}) => {
  const { reduce } = useMotion();
  const target = mood ? (mood / 5) * height : 0;
  const h = useSharedValue(reduce ? target : 0);
  useEffect(() => {
    h.value = reduce ? target : withDelay(120 + index * 24, withSpring(target, motion.spring.settle));
  }, [h, index, reduce, target]);
  const style = useAnimatedStyle(() => ({ height: h.value }));

  if (!mood) {
    return (
      <View style={styles.barSlot}>
        <View style={[styles.emptyDot, { borderColor: track }]} />
      </View>
    );
  }
  return (
    <View style={styles.barSlot}>
      <Animated.View style={[styles.bar, { backgroundColor: color, opacity: 0.4 + mood * 0.12 }, style]} />
    </View>
  );
};

/*
 * DailyCheckInCard — "How are you feeling today?" Five faces; a tap saves
 * at once. It then opens optional symptoms and a note, and folds to a
 * one-line summary with Edit. Pass `date` to edit a past day (Diary).
 */
export function DailyCheckInCard({
  date,
  showLink = true,
  bare = false,
}: {
  date?: string;
  showLink?: boolean;
  /** No card chrome, small date line: for rows inside a grouped list (Diary). */
  bare?: boolean;
} = {}) {
  const { c } = useTokens();
  const { t, formatDate } = useLocale();
  const { reduce } = useMotion();
  const router = useRouter();
  const diary = useDiary();
  const key = date ?? todayKey();
  const isToday = key === todayKey();
  const entry = diary.map[key];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry?.note ?? '');

  useEffect(() => setDraft(entry?.note ?? ''), [entry?.note]);

  const lilac = c.tones.lilac;
  const layout = reduce ? undefined : LinearTransition.springify().damping(motion.spring.gentle.damping).stiffness(motion.spring.gentle.stiffness);
  const title = isToday ? t('diaryCheckInTitle') : formatDate(dateFromKey(key), { weekday: 'short', day: 'numeric', month: 'short' });

  if (diary.isLoading) return null;

  const showFaces = !entry || editing;
  const Wrap = bare ? View : Card;

  const pickMood = (mood: Mood) => {
    triggerHaptic('success');
    if (!entry) setEditing(true);
    void diary.save(key, { mood });
  };

  const toggleSymptom = (code: SymptomCode) => {
    if (!entry) return;
    const has = entry.symptoms.includes(code);
    void diary.save(key, { symptoms: has ? entry.symptoms.filter((s) => s !== code) : [...entry.symptoms, code] });
  };

  const saveNote = () => {
    if (entry && (entry.note ?? '') !== draft.trim()) void diary.save(key, { note: draft });
  };

  const finish = () => {
    saveNote();
    setEditing(false);
  };

  const header = (
    <View style={[styles.header, bare && { minHeight: 0 }]}>
      <Text
        accessibilityRole="header"
        numberOfLines={2}
        style={[
          bare ? typography.footnote : typography.headline,
          styles.flex,
          bare ? { color: c.textSecondary, fontFamily: font.semibold } : { color: c.textPrimary, fontFamily: font.bold },
        ]}
      >
        {title}
      </Text>
      {showLink && !editing ? (
        <AnimatedPressable
          accessibilityRole="link"
          accessibilityLabel={`${t('diarySeeAll')}, ${t('diaryRouteTitle')}`}
          onPress={() => router.push('/diary' as never)}
          style={styles.link}
        >
          <Text style={[typography.subhead, { color: c.textPrimary, fontFamily: font.semibold }]}>{t('diarySeeAll')}</Text>
          <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />
        </AnimatedPressable>
      ) : null}
    </View>
  );

  return (
    <Animated.View layout={layout}>
      <Wrap style={bare ? styles.bare : styles.card}>
        {header}

        {showFaces ? (
          <Animated.View key="faces" entering={reduce ? undefined : FadeIn.duration(180)} style={styles.faces}>
            {MOODS.map((mood) => {
              const selected = entry?.mood === mood;
              return (
                <AnimatedPressable
                  key={mood}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t('diaryMoodA11y').replace('{mood}', moodLabel(mood, t))}
                  scaleTo={0.92}
                  onPress={() => pickMood(mood)}
                  style={[
                    styles.face,
                    {
                      backgroundColor: selected ? lilac.bg : c.surfaceRaised,
                      borderColor: selected ? lilac.fg : 'transparent',
                    },
                  ]}
                >
                  <MoodFace mood={mood} color={selected ? INK : c.textPrimary} />
                  {selected ? (
                    <Animated.View
                      entering={reduce ? undefined : ZoomIn.duration(220)}
                      style={[styles.check, { backgroundColor: lilac.fg, borderColor: c.surface }]}
                    >
                      <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                    </Animated.View>
                  ) : null}
                </AnimatedPressable>
              );
            })}
          </Animated.View>
        ) : entry ? (
          <Animated.View key="summary" entering={reduce ? undefined : FadeIn.duration(220)} style={styles.summary}>
            <View style={[styles.summaryFace, { backgroundColor: lilac.bg }]}>
              <MoodFace mood={entry.mood} size={24} color={INK} />
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={2} style={[typography.callout, { color: c.textPrimary, fontFamily: font.semibold }]}>
                {entrySummary(entry.mood, entry.symptoms, t)}
              </Text>
              {entry.note ? (
                <Text numberOfLines={1} style={[typography.footnote, { color: c.textSecondary }]}>
                  {entry.note}
                </Text>
              ) : null}
            </View>
            <Button kind="secondary" size="sm" fullWidth={false} label={t('diaryEdit')} onPress={() => setEditing(true)} />
          </Animated.View>
        ) : null}

        {editing && entry ? (
          <Animated.View
            entering={reduce ? undefined : FadeInDown.duration(motion.duration.slow)}
            exiting={reduce ? undefined : FadeOut.duration(motion.duration.fast)}
            style={styles.more}
          >
            <Text style={[typography.subhead, { color: c.textSecondary }]}>
              <Text style={{ color: c.textPrimary, fontFamily: font.semibold }}>{moodLabel(entry.mood, t)}</Text>
              {'  ·  '}
              {t('diarySymptomsPrompt')}
            </Text>
            <View style={styles.chips}>
              {SYMPTOM_CODES.map((code) => {
                const on = entry.symptoms.includes(code);
                return (
                  <AnimatedPressable
                    key={code}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={symptomLabel(code, t)}
                    haptic="light"
                    onPress={() => toggleSymptom(code)}
                    style={[
                      styles.chip,
                      { backgroundColor: on ? lilac.bg : 'transparent', borderColor: on ? lilac.bg : c.separator },
                    ]}
                  >
                    {on ? <Ionicons name="checkmark" size={15} color={INK} /> : null}
                    <Text style={[typography.subhead, { color: on ? INK : c.textPrimary, fontFamily: font.semibold }]}>
                      {symptomLabel(code, t)}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
            <Input
              value={draft}
              onChangeText={setDraft}
              onBlur={saveNote}
              maxLength={500}
              accessibilityLabel={t('diaryNoteLabel')}
              placeholder={t('diaryNoteLabel')}
              returnKeyType="done"
              onSubmitEditing={finish}
              style={styles.note}
            />
            <Button kind="primary" size="sm" label={t('diaryDone')} onPress={finish} />
          </Animated.View>
        ) : null}
      </Wrap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing(4), gap: spacing(3) },
  bare: { paddingHorizontal: spacing(4), paddingVertical: spacing(3), gap: spacing(2) },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), minHeight: 28 },
  flex: { flex: 1, minWidth: 0 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, marginVertical: -8, paddingLeft: spacing(2) },
  faces: { flexDirection: 'row', gap: spacing(2) },
  face: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  summaryFace: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  more: { gap: spacing(3) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    minHeight: 44,
    paddingHorizontal: spacing(3.5),
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  note: { minHeight: 48, fontSize: 16 },
  strip: { flexDirection: 'row', alignItems: 'flex-end' },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '100%', maxWidth: 18, borderRadius: 6 },
  emptyDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, marginBottom: 1 },
});
