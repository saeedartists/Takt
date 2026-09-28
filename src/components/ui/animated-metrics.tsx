import { useEffect, useRef, useState } from 'react';
import { Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useMotion } from '../../theme/use-motion';

/*
 * AnimatedNumber — counts up to `value` with an ease-out when it first
 * appears or changes. Small numbers (dose counts) settle in ~500 ms,
 * big ones stay under ~900 ms. Reduce Motion shows the final value.
 */
export function AnimatedNumber({
  value,
  style,
  suffix = '',
  delay = 0,
  accessibilityLabel,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  suffix?: string;
  delay?: number;
  accessibilityLabel?: string;
}) {
  const { reduce } = useMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = from.current;
    const delta = value - start;
    if (delta === 0) return;
    const duration = Math.min(900, 420 + Math.abs(delta) * 8);
    let raf = 0;
    let t0 = 0;
    const timer = setTimeout(() => {
      const tick = (now: number) => {
        if (!t0) t0 = now;
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(Math.round(start + delta * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
        else from.current = value;
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [delay, reduce, value]);

  return (
    <Text style={[style, { fontVariant: ['tabular-nums'] }]} accessibilityLabel={accessibilityLabel ?? `${value}${suffix}`}>
      {shown}
      {suffix}
    </Text>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/*
 * ProgressRing — a round track that draws its arc in from zero.
 * `progress` is 0..1. Children render centred inside the ring.
 */
export function ProgressRing({
  progress,
  size = 64,
  stroke = 8,
  color,
  track,
  delay = 150,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color: string;
  track: string;
  delay?: number;
  children?: React.ReactNode;
}) {
  const { reduce } = useMotion();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const drawn = useSharedValue(reduce ? clamped : 0);

  useEffect(() => {
    drawn.value = reduce
      ? clamped
      : withDelay(delay, withTiming(clamped, { duration: 750, easing: Easing.out(Easing.cubic) }));
  }, [clamped, delay, drawn, reduce]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - drawn.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      </View>
      {children}
    </View>
  );
}
