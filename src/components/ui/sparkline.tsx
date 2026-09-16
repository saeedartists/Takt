import type { ReactNode } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { categoryColors, type HealthCategory } from '../../theme/tokens';

const SvgDefs = Defs as React.ComponentType<{ children?: ReactNode }>;

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
