import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '@/components/ui';
import { useTokens } from '@/theme/use-tokens';
import type { MedicationAppearance } from '@/lib/takt/types';

type Props = {
  appearance?: MedicationAppearance;
  /** Fallback when no appearance was chosen: the form text decides the icon. */
  form?: string;
  size?: number;
  /** Tint for the fallback icon and its tile. */
  tint?: string;
};

const fallbackIcon = (form?: string): keyof typeof Ionicons.glyphMap => {
  const key = (form ?? '').toLowerCase();
  if (key.includes('capsul') || key.includes('kapsel')) return 'bandage-outline';
  if (key.includes('drop') || key.includes('tropf')) return 'water-outline';
  if (key.includes('inhal')) return 'fitness-outline';
  if (key.includes('inject') || key.includes('injekt') || key.includes('spritz')) return 'color-filter-outline';
  return 'medkit';
};

/** Pale colours get an outline so a white tablet is still visible on a white tile. */
const isPale = (hex: string): boolean => {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 200;
};

/*
 * MedicationGlyph — a small drawing of the tablet (shape + colour) so a
 * row icon looks like the real thing in the pill box. Falls back to the
 * form icon for plans saved before appearance existed.
 */
export function MedicationGlyph({ appearance, form, size = 34, tint }: Props) {
  const { c } = useTokens();
  const tile = { width: size, height: size, borderRadius: radius.md };
  const accent = tint ?? c.accent;

  if (!appearance) {
    return (
      <View style={[styles.tile, tile, { backgroundColor: `${accent}1A` }]}>
        <Ionicons name={fallbackIcon(form)} size={Math.round(size * 0.47)} color={accent} />
      </View>
    );
  }

  const { shape, color } = appearance;
  const stroke = isPale(color) ? c.separator : 'transparent';
  const s = size;
  const inner = Math.round(s * 0.7);
  const off = (s - inner) / 2;

  const drawing = (() => {
    switch (shape) {
      case 'round':
        return <Circle cx={s / 2} cy={s / 2} r={inner / 2} fill={color} stroke={stroke} strokeWidth={1} />;
      case 'oval':
        return <Ellipse cx={s / 2} cy={s / 2} rx={inner / 2} ry={inner / 3} fill={color} stroke={stroke} strokeWidth={1} />;
      case 'capsule':
        return (
          <>
            <Rect x={off} y={s / 2 - inner / 5} width={inner} height={inner / 2.5} rx={inner / 5} fill={color} stroke={stroke} strokeWidth={1} />
            <Rect x={s / 2} y={s / 2 - inner / 5} width={inner / 2} height={inner / 2.5} rx={inner / 5} fill="rgba(255,255,255,0.45)" />
          </>
        );
      case 'drops':
        return (
          <Path
            d={`M ${s / 2} ${off} C ${s / 2 + inner / 2} ${s / 2 + inner / 6}, ${s / 2 + inner / 3} ${s - off}, ${s / 2} ${s - off} C ${s / 2 - inner / 3} ${s - off}, ${s / 2 - inner / 2} ${s / 2 + inner / 6}, ${s / 2} ${off} Z`}
            fill={color}
            stroke={stroke}
            strokeWidth={1}
          />
        );
      case 'inhaler':
        return (
          <>
            <Rect x={s / 2 - inner / 6} y={off} width={inner / 3} height={inner * 0.75} rx={inner / 10} fill={color} stroke={stroke} strokeWidth={1} />
            <Rect x={s / 2 - inner / 6} y={off + inner * 0.55} width={inner * 0.62} height={inner / 4} rx={inner / 12} fill={color} stroke={stroke} strokeWidth={1} />
          </>
        );
      case 'injection':
        return (
          <>
            <Rect x={off} y={s / 2 - inner / 8} width={inner * 0.7} height={inner / 4} rx={inner / 16} fill={color} stroke={stroke} strokeWidth={1} />
            <Rect x={off + inner * 0.7} y={s / 2 - inner / 24} width={inner * 0.3} height={inner / 12} fill={c.textSecondary} />
          </>
        );
      default:
        return <Rect x={off} y={off} width={inner} height={inner} rx={inner / 4} fill={color} stroke={stroke} strokeWidth={1} />;
    }
  })();

  return (
    <View style={[styles.tile, tile, { backgroundColor: c.surfaceRaised }]}>
      <Svg width={s} height={s}>{drawing}</Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
