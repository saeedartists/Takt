import Svg, { Path } from 'react-native-svg';

import { categoryColors, type HealthCategory } from '../../theme/tokens';

/*
 * Sparkline — inline trend line via react-native-svg (already a
 * scaffold dep, pulled in by @ovok/native). No charting library, same
 * rationale as web: Health's charts are a single stroke with an
 * optional soft fill.
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
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; render it centred instead.
  const span = max - min || 1;
  const tint = categoryColors[category];

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - pad - ((v - min) / span) * (H - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${W.toString()},${H.toString()} L0,${H.toString()} Z`;

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W.toString()} ${H.toString()}`}>
      {filled ? <Path d={area} fill={tint} fillOpacity={0.12} /> : null}
      <Path
        d={line}
        stroke={tint}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
