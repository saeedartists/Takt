import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { View } from 'react-native';

import { INK, PAPER } from '../../theme/tokens';

/*
 * Brand glyphs Ionicons lacks. Same 2pt rounded stroke on a 24 grid so
 * they sit next to Ionicons outline icons without looking borrowed.
 */

/** A tilted capsule: the medications tab and the brand's pill motif. */
export const PillIcon = ({ size = 22, color = INK, filled = false }: { size?: number; color?: string; filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <G transform="rotate(-40 12 12)">
      <Rect x={2.5} y={8.25} width={19} height={7.5} rx={3.75} fill={filled ? color : 'none'} stroke={color} strokeWidth={2} />
      <Path d="M12 8.25v7.5" stroke={filled ? PAPER : color} strokeWidth={filled ? 1.6 : 2} strokeLinecap="round" />
    </G>
  </Svg>
);

/** The Takt mark: an ink tile, a two-tone capsule and the beat dot. */
export const TaktMark = ({ size = 40, tone = '#FAD6B4', deep = '#E8894A', dot = PAPER }: { size?: number; tone?: string; deep?: string; dot?: string }) => (
  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width={48} height={48} rx={15} fill={INK} />
      <G transform="rotate(-38 24 25)">
        <Path d="M17 19h7v12h-7a6 6 0 0 1 0-12z" fill={deep} />
        <Path d="M24 19h7a6 6 0 0 1 0 12h-7z" fill={tone} />
      </G>
      <Circle cx={37} cy={11} r={3.6} fill={dot} />
    </Svg>
  </View>
);
