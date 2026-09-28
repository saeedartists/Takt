import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { INK, categoryColors, motion, spacing, typography, type HealthCategory, font } from '../../theme/tokens';
import { useMotion } from '../../theme/use-motion';
import { useTokens } from '../../theme/use-tokens';

const SvgDefs = Defs as React.ComponentType<{ children?: ReactNode }>;
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export type AdherenceBarDay = {
  key: string;
  /** Axis label under the bar; empty string hides it. */
  label: string;
  /** 0–100. */
  pct: number;
  /** False when nothing was logged that day: a faint stub is drawn instead of a bar. */
  logged: boolean;
  isToday: boolean;
};

const BAR_MAX_WIDTH = 14;
const BAR_MIN_HEIGHT = 4;
const LABEL_WIDTH = 28;

/** Grows from the baseline to `height`, and glides to a new height when the data changes. */
const GrowingBar = ({
  x,
  width,
  height,
  chartHeight,
  color,
  delay,
  reduce,
}: {
  x: number;
  width: number;
  height: number;
  chartHeight: number;
  color: string;
  delay: number;
  reduce: boolean;
}) => {
  const h = useSharedValue(reduce ? height : 0);
  const grown = useRef(false);

  useEffect(() => {
    // Stagger only the first rise; later data changes glide at once.
    h.value = reduce ? height : withDelay(grown.current ? 0 : delay, withSpring(height, motion.spring.settle));
    grown.current = true;
  }, [delay, h, height, reduce]);

  const animatedProps = useAnimatedProps(() => ({
    y: chartHeight - h.value,
    height: h.value,
  }));

  return <AnimatedRect x={x} width={width} rx={width / 2} fill={color} animatedProps={animatedProps} />;
};

/*
 * AdherenceBars — one pill bar per day of a history window, drawn for the
 * lilac insights tile (tiles stay light in dark mode, so marks are ink).
 * Bars rise left to right from the baseline; a new window length remounts
 * the set so it re-grows, while a data change glides each bar to its new
 * height. Today is the palette's accent. Static under reduce motion.
 */
export const AdherenceBars = ({
  days,
  height = 112,
  accessibilityLabel,
}: {
  days: ReadonlyArray<AdherenceBarDay>;
  height?: number;
  accessibilityLabel?: string;
}) => {
  const { c, paletteConfig } = useTokens();
  const { reduce, stagger } = useMotion();
  const [width, setWidth] = useState(0);

  if (days.length === 0) return null;

  const slot = width / days.length;
  const barWidth = Math.min(BAR_MAX_WIDTH, slot * 0.6);
  const lilacFg = c.tones.lilac.fg;
  // Spread the stagger over the whole row so 30 bars still sweep left to right in ~0.6 s.
  const step = days.length > 14 ? 20 : motion.stagger;

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.bars}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg key={days.length} width={width} height={height}>
            {days.map((day, i) => {
              const x = i * slot + (slot - barWidth) / 2;
              if (!day.logged) {
                return (
                  <Rect key={day.key} x={x} y={height - barWidth} width={barWidth} height={barWidth} rx={barWidth / 2} fill="rgba(21,23,28,0.14)" />
                );
              }
              return (
                <GrowingBar
                  key={day.key}
                  x={x}
                  width={barWidth}
                  height={Math.max(BAR_MIN_HEIGHT, barWidth, (Math.max(0, Math.min(100, day.pct)) / 100) * height)}
                  chartHeight={height}
                  color={day.isToday ? paletteConfig.accentLight : INK}
                  delay={reduce ? 0 : stagger(0) + i * step}
                  reduce={reduce}
                />
              );
            })}
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>
      {/* Labels sit centred under their bar and may be wider than a 30-day slot. */}
      <View style={styles.labels}>
        {width > 0
          ? days.map((day, i) =>
              day.label ? (
                <Text
                  key={day.key}
                  numberOfLines={1}
                  style={[
                    typography.caption,
                    styles.label,
                    { left: i * slot + slot / 2 - LABEL_WIDTH / 2 },
                    day.isToday
                      ? { color: paletteConfig.onSoft, fontFamily: font.bold }
                      : { color: lilacFg, fontFamily: font.medium },
                  ]}
                >
                  {day.label}
                </Text>
              ) : null,
            )
          : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bars: { gap: spacing(1.5) },
  labels: { height: 18 },
  label: { position: 'absolute', top: 0, width: LABEL_WIDTH, textAlign: 'center', fontVariant: ['tabular-nums'] },
});

/*
 * Sparkline — inline trend line via react-native-svg.
 * Displays Apple Health style smooth stroke with soft vertical gradient fill.
 */
export const Sparkline = ({
  values,
  category = 'lab',
  height = 44,
  filled = true,
}: {
  /** Chronological series. Fewer than 2 points renders nothing. */
  values: ReadonlyArray<number>;
  category?: HealthCategory;
  height?: number;
  filled?: boolean;
}) => {
  if (values.length < 2) return null;

  const W = 100;
  const H = height;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const tint = categoryColors[category];
  const gradId = `sparkGrad_${category}_${height}`;

  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - pad - ((v - min) / span) * (H - pad * 2);
    return { x, y };
  });

  const pts = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`);
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${W.toString()},${H.toString()} L0,${H.toString()} Z`;
  const lastCoord = coords[coords.length - 1];

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W.toString()} ${H.toString()}`}>
      <SvgDefs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={tint} stopOpacity="0.28" />
          <Stop offset="100%" stopColor={tint} stopOpacity="0.02" />
        </LinearGradient>
      </SvgDefs>
      {filled ? <Path d={area} fill={`url(#${gradId})`} /> : null}
      <Path
        d={line}
        stroke={tint}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {lastCoord ? (
        <Circle cx={lastCoord.x} cy={lastCoord.y} r={3} fill={tint} stroke="#FFFFFF" strokeWidth={1} />
      ) : null}
    </Svg>
  );
};
