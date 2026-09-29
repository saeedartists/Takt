import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import {
  Button,
  CONTENT_MAX_WIDTH,
  INK,
  TaktMark,
  radius,
  spacing,
  typography,
  useMotion,
  type Tone,
  type ToneName,
} from '@/components/ui';
import { TOUR_SEEN_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { useTokens } from '@/theme/use-tokens';

const WHITE = '#FFFFFF';

/*
 * First-run tour: three swipeable pages, each a pastel tile with a drawn
 * illustration, a title and one calm sentence. Shown once after consent;
 * also reachable later (e.g. from Settings), where finishing goes back.
 */
export default function TourScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { c } = useTokens();
  const { reduce } = useMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  // Pages take the measured height of the pager so the tile can flex on every platform.
  const [pagerHeight, setPagerHeight] = useState(0);

  const pages: {
    tone: ToneName;
    title: string;
    body: string;
    Art: typeof BellArt;
  }[] = [
    {
      tone: 'sky',
      title: t('tourRemindersTitle'),
      body: t('tourRemindersBody'),
      Art: BellArt,
    },
    {
      tone: 'sage',
      title: t('tourTakenTitle'),
      body: t('tourTakenBody'),
      Art: TakenArt,
    },
    {
      tone: 'butter',
      title: t('tourReportTitle'),
      body: t('tourReportBody'),
      Art: ReportArt,
    },
  ];
  const last = index === pages.length - 1;

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });
  useAnimatedReaction(
    () => Math.round(scrollX.value / Math.max(width, 1)),
    (next, prev) => {
      if (next !== prev) runOnJS(setIndex)(next);
    },
    [width],
  );

  const finish = async () => {
    await AsyncStorage.setItem(TOUR_SEEN_STORAGE_KEY, '1').catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/today');
  };

  const next = () => {
    if (last) void finish();
    else
      scrollRef.current?.scrollTo({
        x: (index + 1) * width,
        animated: !reduce,
      });
  };

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: c.background,
          paddingTop: insets.top + spacing(2),
          paddingBottom: insets.bottom + spacing(4),
        },
      ]}
    >
      <View style={[styles.bar, styles.gutter]}>
        <TaktMark size={32} />
        <Button kind="ghost" size="sm" fullWidth={false} label={t('tourSkip')} onPress={() => void finish()} />
      </View>

      <View style={styles.flex} onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={StyleSheet.absoluteFill}
        >
          {pages.map((page, i) => (
            <View key={page.tone} style={[styles.page, styles.gutter, { width, height: pagerHeight }]}>
              <View style={styles.column}>
                <View style={[styles.tile, { backgroundColor: c.tones[page.tone].bg }]}>
                  <ArtEntrance active={index === i} reduce={reduce}>
                    <page.Art tone={c.tones[page.tone]} />
                  </ArtEntrance>
                </View>
                <View style={styles.copy}>
                  <Text accessibilityRole="header" style={[typography.title1, { color: c.textPrimary }]}>
                    {page.title}
                  </Text>
                  <Text style={[typography.body, { color: c.textSecondary }]}>{page.body}</Text>
                </View>
              </View>
            </View>
          ))}
        </Animated.ScrollView>
      </View>

      <View style={[styles.footer, styles.gutter]}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={t('tourPageOf')
            .replace('{current}', String(index + 1))
            .replace('{total}', String(pages.length))}
        >
          {pages.map((page, i) => (
            <Dot key={page.tone} i={i} width={width} scrollX={scrollX} color={c.textPrimary} />
          ))}
        </View>
        <View style={styles.action}>
          <Button
            size="lg"
            accentIcon={last ? 'checkmark' : 'arrow-forward'}
            label={last ? t('tourGetStarted') : t('tourNext')}
            onPress={next}
          />
        </View>
      </View>
    </View>
  );
}

/* A dot widens into a short bar as its page scrolls in. */
const Dot = ({ i, width, scrollX, color }: { i: number; width: number; scrollX: SharedValue<number>; color: string }) => {
  const style = useAnimatedStyle(() => {
    const p = interpolate(scrollX.value / Math.max(width, 1), [i - 1, i, i + 1], [0, 1, 0], Extrapolation.CLAMP);
    return { width: 8 + p * 16, opacity: 0.25 + p * 0.75 };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
};

/* Fades and settles the illustration the first time its page is shown. */
const ArtEntrance = ({ active, reduce, children }: { active: boolean; reduce: boolean; children: ReactNode }) => {
  const shown = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (active) shown.value = reduce ? 1 : withTiming(1, { duration: 520 });
  }, [active, reduce, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: 0.9 + shown.value * 0.1 }, { translateY: (1 - shown.value) * 8 }],
  }));
  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.art, style]}>
      {children}
    </Animated.View>
  );
};

/*
 * Illustrations: 200×160, drawn on the light pastel tile, so they use the
 * tone's deep colour, white and ink only (tiles stay light in dark mode).
 */
type ArtProps = { tone: Tone };

const Capsule = ({ x, y, angle, deep, light }: { x: number; y: number; angle: number; deep: string; light: string }) => (
  <G transform={`translate(${x} ${y}) rotate(${angle})`}>
    <Path d="M0 -11h-17a11 11 0 0 0 0 22h17z" fill={deep} />
    <Path d="M0 -11h17a11 11 0 0 1 0 22h-17z" fill={light} />
  </G>
);

const BellArt = ({ tone }: ArtProps) => (
  <Svg width="100%" height="100%" viewBox="0 0 200 160">
    <Circle cx={100} cy={80} r={58} fill={WHITE} opacity={0.6} />
    {/* sound rings */}
    <Path d="M52 58a52 52 0 0 0 0 44" stroke={tone.fg} strokeWidth={5} strokeLinecap="round" fill="none" />
    <Path d="M36 48a70 70 0 0 0 0 64" stroke={tone.fg} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.45} />
    <Path d="M148 58a52 52 0 0 1 0 44" stroke={tone.fg} strokeWidth={5} strokeLinecap="round" fill="none" />
    <Path d="M164 48a70 70 0 0 1 0 64" stroke={tone.fg} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.45} />
    {/* bell */}
    <G transform="rotate(-10 100 80)">
      <Circle cx={100} cy={40} r={6} fill={INK} />
      <Path d="M100 44c-18 0-30 13-30 31v17c0 6-3 10-8 13h76c-5-3-8-7-8-13V75c0-18-12-31-30-31z" fill={INK} />
      <Rect x={58} y={102} width={84} height={9} rx={4.5} fill={INK} />
      <Circle cx={100} cy={118} r={8} fill={INK} />
    </G>
    <Capsule x={146} y={126} angle={-35} deep={tone.fg} light={WHITE} />
  </Svg>
);

const TakenArt = ({ tone }: ArtProps) => (
  <Svg width="100%" height="100%" viewBox="0 0 200 160">
    <G transform="translate(92 78) rotate(-35) scale(1.9)">
      <Path d="M0 -11h-17a11 11 0 0 0 0 22h17z" fill={tone.fg} />
      <Path d="M0 -11h17a11 11 0 0 1 0 22h-17z" fill={WHITE} />
    </G>
    <Circle cx={138} cy={108} r={27} fill={INK} stroke={tone.bg} strokeWidth={6} />
    <Path d="M126 108l8 8 16-17" stroke={WHITE} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* the other two answers, quieter */}
    <Circle cx={44} cy={128} r={6} fill={tone.fg} opacity={0.35} />
    <Circle cx={62} cy={128} r={6} fill={tone.fg} opacity={0.35} />
    <Circle cx={80} cy={128} r={6} fill={tone.fg} />
  </Svg>
);

const ReportArt = ({ tone }: ArtProps) => (
  <Svg width="100%" height="100%" viewBox="0 0 200 160">
    {/* sheet with a folded corner */}
    <Path d="M62 14h56l22 22v106a8 8 0 0 1-8 8H62a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8z" fill={WHITE} />
    <Path d="M118 14v16a6 6 0 0 0 6 6h16z" fill={tone.bg} opacity={0.9} />
    <Rect x={68} y={30} width={36} height={7} rx={3.5} fill={INK} />
    {/* a week of adherence bars */}
    {[34, 40, 26, 40, 40, 32, 40].map((h, i) => (
      <Rect key={i} x={70 + i * 9.5} y={96 - h} width={6} height={h} rx={3} fill={tone.fg} opacity={h === 40 ? 1 : 0.45} />
    ))}
    <Rect x={68} y={108} width={58} height={6} rx={3} fill={tone.fg} opacity={0.3} />
    <Rect x={68} y={122} width={42} height={6} rx={3} fill={tone.fg} opacity={0.3} />
    {/* checked and ready seal */}
    <Circle cx={142} cy={122} r={20} fill={INK} stroke={tone.bg} strokeWidth={5} />
    <Path d="M133 122l6 6 12-13" stroke={WHITE} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  gutter: { paddingHorizontal: spacing(5) },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  page: { paddingTop: spacing(4), alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, justifyContent: 'center' },
  tile: {
    flex: 1,
    maxHeight: 400,
    minHeight: 170,
    borderRadius: radius.xl,
    padding: spacing(5),
    overflow: 'hidden',
  },
  action: { width: '100%', maxWidth: CONTENT_MAX_WIDTH },
  art: { flex: 1 },
  // Room for a two-line title and three body lines, so every tile keeps the same height.
  copy: { gap: spacing(2), paddingTop: spacing(5), paddingBottom: spacing(2), minHeight: 172 },
  footer: { gap: spacing(5), alignItems: 'center', paddingTop: spacing(3) },
  dots: {
    flexDirection: 'row',
    gap: spacing(1.5),
    alignItems: 'center',
    height: 8,
  },
  dot: { height: 8, borderRadius: radius.full },
});
