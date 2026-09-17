import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { categoryColors, motion, spacing, typography, type HealthCategory } from '../../theme/tokens';
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
const BAR_MIN_HEIGHT = 3;

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
  const grow = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    grow.value = reduce ? 1 : withDelay(delay, withSpring(1, motion.spring.gentle));
  }, [delay, grow, reduce]);

  const animatedProps = useAnimatedProps(() => ({
    y: chartHeight - height * grow.value,
    height: height * grow.value,
  }));

  return <AnimatedRect x={x} width={width} rx={2} fill={color} animatedProps={animatedProps} />;
};

/*
 * AdherenceBars — one bar per day of a history window. Bars spring up from
 * the baseline on mount (staggered, static under reduce motion); today is
 * drawn in the accent colour. Labels are plain Text so they use the type ramp.
 */
export const AdherenceBars = ({
  days,
  height = 72,
  accessibilityLabel,
}: {
  days: ReadonlyArray<AdherenceBarDay>;
  height?: number;
  accessibilityLabel?: string;
}) => {
  const { c } = useTokens();
  const { reduce, stagger } = useMotion();
  const [width, setWidth] = useState(0);

  if (days.length === 0) return null;

  const slot = width / days.length;
  const barWidth = Math.min(BAR_MAX_WIDTH, slot * 0.6);
  const usable = height - 2;

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.bars}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Rect x={0} y={height - StyleSheet.hairlineWidth} width={width} height={StyleSheet.hairlineWidth} fill={c.separator} />
            {days.map((day, i) => {
              const x = i * slot + (slot - barWidth) / 2;
              if (!day.logged) {
                return <Rect key={day.key} x={x} y={height - 2} width={barWidth} height={2} rx={1} fill={c.separator} />;
              }
              return (
                <GrowingBar
                  key={day.key}
                  x={x}
                  width={barWidth}
                  height={Math.max(BAR_MIN_HEIGHT, (Math.max(0, Math.min(100, day.pct)) / 100) * usable)}
                  chartHeight={height}
                  color={day.isToday ? c.accent : c.success}
                  delay={stagger(i)}
                  reduce={reduce}
                />
              );
            })}
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>
      <View style={styles.labels}>
        {days.map((day) => (
          <Text
            key={day.key}
            numberOfLines={1}
            style={[
              typography.caption,
              styles.label,
              { color: day.isToday ? c.accent : c.textTertiary, fontWeight: day.isToday ? '600' : '400' },
            ]}
          >
            {day.label}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bars: { gap: spacing(1) },
  labels: { flexDirection: 'row' },
  label: { flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
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
