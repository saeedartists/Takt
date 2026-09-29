/*
 * Design tokens — Takt brand v2 ("your medicines, in rhythm").
 *
 * Paper ground, ink text and actions, and six pastel tones that each
 * carry exactly one meaning:
 *   apricot  now / next dose (the brand tone)
 *   sage     taken, done
 *   sky      schedule, reminders
 *   lilac    insights, profile
 *   butter   supply, refills
 *   rose     missed — History and the doctor report only
 *
 * Text on any tone is always ink (or the tone's own deep `fg`), so every
 * pair clears WCAG AA. Tones stay light in dark mode; only the ground and
 * cards go dark. Source of truth: the "Takt Brand & Screens" design canvas.
 */

/** Kept for sparkline/legacy callers; not part of the brand palette. */
export const iosPalette = {
  light: {
    red: '#FF3B30',
    orange: '#FF9500',
    yellow: '#FFCC00',
    green: '#34C759',
    mint: '#00C7BE',
    teal: '#30B0C7',
    cyan: '#32ADE6',
    blue: '#007AFF',
    indigo: '#5856D6',
    purple: '#AF52DE',
    pink: '#FF2D55',
    gray: '#8E8E93',
    gray2: '#AEAEB2',
    gray3: '#C7C7CC',
    gray4: '#D1D1D6',
    gray5: '#E5E5EA',
    gray6: '#F2F2F7',
  },
  dark: {
    red: '#FF453A',
    orange: '#FF9F0A',
    yellow: '#FFD60A',
    green: '#30D158',
    mint: '#63E6E2',
    teal: '#40C8E0',
    cyan: '#64D2FF',
    blue: '#0A84FF',
    indigo: '#5E5CE6',
    purple: '#BF5AF2',
    pink: '#FF375F',
    gray: '#8E8E93',
    gray2: '#636366',
    gray3: '#48484A',
    gray4: '#3A3A3C',
    gray5: '#2C2C2E',
    gray6: '#1C1C1E',
  },
} as const;

/** Ink that never inverts — for text and buttons sitting on a pastel tone. */
export const INK = '#15171C';
export const PAPER = '#F5F2ED';

export type ToneName = 'apricot' | 'sage' | 'sky' | 'lilac' | 'butter' | 'rose';
export type Tone = {
  /** Tile / chip fill. */
  bg: string;
  /** Deep companion: icons, numbers and secondary text on `bg`. */
  fg: string;
  /** Solid mark (dots, bars, progress) readable on `bg` and on paper. */
  solid: string;
};

const tonesLight: Record<ToneName, Tone> = {
  apricot: { bg: '#FAD6B4', fg: '#5C3309', solid: '#B4611C' },
  sage: { bg: '#CDE6D0', fg: '#17573A', solid: '#1F6F4A' },
  sky: { bg: '#CFE2F3', fg: '#1B3A55', solid: '#245C8A' },
  lilac: { bg: '#DDD7F6', fg: '#3D3470', solid: '#4B3F99' },
  butter: { bg: '#F7E8A4', fg: '#4F3D00', solid: '#7A5B00' },
  rose: { bg: '#F6D0CB', fg: '#8E2A21', solid: '#A8342A' },
};

const tonesDark: Record<ToneName, Tone> = {
  apricot: { bg: '#F4C9A0', fg: '#4A2807', solid: '#F0A36D' },
  sage: { bg: '#B8DDBF', fg: '#123F2A', solid: '#7BD19B' },
  sky: { bg: '#BDD6EC', fg: '#15314A', solid: '#8EC0EC' },
  lilac: { bg: '#C9C0F0', fg: '#2F2760', solid: '#B3A8F2' },
  butter: { bg: '#F2DC86', fg: '#3F3100', solid: '#F2DC86' },
  rose: { bg: '#F0BDB6', fg: '#6E1E17', solid: '#F08A80' },
};

/*
 * Legacy category colours (sparkline tints). Mapped onto the brand
 * solids so older charts land in-palette.
 */
export const categoryColors = {
  heart: tonesLight.rose.solid,
  activity: tonesLight.apricot.solid,
  sleep: tonesLight.sky.solid,
  nutrition: tonesLight.sage.solid,
  medication: tonesLight.apricot.solid,
  mindfulness: tonesLight.lilac.solid,
  body: tonesLight.lilac.solid,
  respiratory: tonesLight.sky.solid,
  lab: tonesLight.sky.solid,
};

export type HealthCategory =
  | 'heart'
  | 'activity'
  | 'sleep'
  | 'nutrition'
  | 'medication'
  | 'mindfulness'
  | 'body'
  | 'respiratory'
  | 'lab';

export type CategoryColors = Record<HealthCategory, string>;

export type ThemePalette = 'amber' | 'sage' | 'indigo' | 'plum';
export type ThemeMode = 'system' | 'light' | 'dark';

type PaletteMessageKey =
  | 'themeAmberName'
  | 'themeAmberDesc'
  | 'themeSageName'
  | 'themeSageDesc'
  | 'themeIndigoName'
  | 'themeIndigoDesc'
  | 'themePlumName'
  | 'themePlumDesc';

/*
 * A palette recolours only the "now" layer: the next-dose tile, the
 * active tab and text links. Taken stays sage and missed stays rose in
 * every palette, so meaning never shifts.
 */
export const paletteConfigs: Record<
  ThemePalette,
  {
    name: string;
    description: string;
    /** Locale keys for the user-facing name/description (see locales/en.ts). */
    nameKey: PaletteMessageKey;
    descriptionKey: PaletteMessageKey;
    accentLight: string;
    accentDark: string;
    softLight: string;
    softDark: string;
    onSoft: string;
    medicationLight: string;
    medicationDark: string;
    previewColor: string;
  }
> = {
  amber: {
    name: 'Apricot',
    description: 'Warm and sunlit',
    nameKey: 'themeAmberName',
    descriptionKey: 'themeAmberDesc',
    accentLight: '#B4611C',
    accentDark: '#F0A36D',
    softLight: '#FAD6B4',
    softDark: '#F4C9A0',
    onSoft: '#5C3309',
    medicationLight: '#B4611C',
    medicationDark: '#F0A36D',
    previewColor: '#B4611C',
  },
  sage: {
    name: 'Sage',
    description: 'Calm and restful',
    nameKey: 'themeSageName',
    descriptionKey: 'themeSageDesc',
    accentLight: '#23704B',
    accentDark: '#7BD19B',
    softLight: '#CDE6D0',
    softDark: '#B8DDBF',
    onSoft: '#17573A',
    medicationLight: '#23704B',
    medicationDark: '#7BD19B',
    previewColor: '#23704B',
  },
  indigo: {
    name: 'Sky',
    description: 'Crisp and clear',
    nameKey: 'themeIndigoName',
    descriptionKey: 'themeIndigoDesc',
    accentLight: '#1D5FA8',
    accentDark: '#8EC0EC',
    softLight: '#CFE2F3',
    softDark: '#BDD6EC',
    onSoft: '#1B3A55',
    medicationLight: '#1D5FA8',
    medicationDark: '#8EC0EC',
    previewColor: '#1D5FA8',
  },
  plum: {
    name: 'Plum',
    description: 'Gentle and mindful',
    nameKey: 'themePlumName',
    descriptionKey: 'themePlumDesc',
    accentLight: '#853982',
    accentDark: '#DDA8D9',
    softLight: '#EBD5EA',
    softDark: '#DDBFDB',
    onSoft: '#4F2350',
    medicationLight: '#853982',
    medicationDark: '#DDA8D9',
    previewColor: '#853982',
  },
};

export const getSemanticColors = (scheme: 'light' | 'dark', palette: ThemePalette = 'amber') => {
  const p = paletteConfigs[palette] ?? paletteConfigs.amber;

  if (scheme === 'light') {
    return {
      background: PAPER,
      surface: '#FFFFFF',
      /** Quiet fills: secondary buttons, segmented tracks, chips. */
      surfaceRaised: '#EDE9E2',
      surfaceSubtle: '#FAF8F4',
      separator: 'rgba(21,23,28,0.10)',
      cardBorder: 'rgba(21,23,28,0.06)',
      textPrimary: INK,
      textSecondary: '#464B54',
      textTertiary: '#5F646D',
      accent: p.accentLight,
      /** The palette's pastel: next-dose tile, active tab. Text on it is `onAccentSoft`. */
      accentSoft: p.softLight,
      onAccentSoft: p.onSoft,
      /** Primary action fill; inverts in dark mode. */
      ink: INK,
      onInk: PAPER,
      /** Floating tab bar. */
      chrome: INK,
      onChrome: 'rgba(245,242,237,0.78)',
      destructive: '#A8342A',
      success: '#1F6F4A',
      warning: '#7A5B00',
      tones: tonesLight,
    };
  }

  return {
    background: '#0F1115',
    surface: '#1A1D23',
    surfaceRaised: '#252932',
    surfaceSubtle: '#14171C',
    separator: 'rgba(245,242,237,0.12)',
    cardBorder: 'rgba(245,242,237,0.07)',
    textPrimary: PAPER,
    textSecondary: 'rgba(245,242,237,0.76)',
    textTertiary: 'rgba(245,242,237,0.58)',
    accent: p.accentDark,
    accentSoft: p.softDark,
    onAccentSoft: p.onSoft,
    ink: PAPER,
    onInk: INK,
    chrome: '#1C1F26',
    onChrome: 'rgba(245,242,237,0.78)',
    destructive: '#F08A80',
    success: '#7BD19B',
    warning: '#F2DC86',
    tones: tonesDark,
  };
};

export type SemanticColors = ReturnType<typeof getSemanticColors>;

export const semantic = {
  light: getSemanticColors('light', 'amber'),
  dark: getSemanticColors('dark', 'amber'),
} as const;

/** Corner radii: tiles 32, cards 28/24, fields 18, pills 999. */
export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 28,
  xxl: 32,
  full: 999,
} as const;

/*
 * Brand faces. Custom fonts carry their weight in the family name, so
 * never pair these with `fontWeight` (Android would fake-bold them):
 * pick the family instead.
 */
export const font = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  displaySemibold: 'BricolageGrotesque_600SemiBold',
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
} as const;

/** Map a numeric weight onto the matching Figtree family. */
export const weight = (w: '400' | '500' | '600' | '700' | '800' | 'normal' | 'bold') => ({
  fontFamily:
    w === '800' || w === '700' || w === 'bold'
      ? font.bold
      : w === '600'
        ? font.semibold
        : w === '500'
          ? font.medium
          : font.regular,
});

/*
 * Type ramp. Display styles (titles, metrics) use Bricolage Grotesque;
 * everything you read uses Figtree. Body never drops below 17 (the
 * primary user is 65+); 13 is the floor for any caption.
 */
export const typography = {
  display: { fontFamily: font.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.9 },
  largeTitle: { fontFamily: font.display, fontSize: 29, lineHeight: 35, letterSpacing: -0.6 },
  title1: { fontFamily: font.display, fontSize: 25, lineHeight: 31, letterSpacing: -0.45 },
  title2: { fontFamily: font.display, fontSize: 21, lineHeight: 27, letterSpacing: -0.3 },
  title3: { fontFamily: font.display, fontSize: 18, lineHeight: 24, letterSpacing: -0.15 },
  headline: { fontFamily: font.semibold, fontSize: 17, lineHeight: 24, letterSpacing: 0 },
  body: { fontFamily: font.regular, fontSize: 17, lineHeight: 24, letterSpacing: 0 },
  callout: { fontFamily: font.regular, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  subhead: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  footnote: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption2: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  /** Uppercase eyebrow: small, bold, letter-spaced. */
  overline: { fontFamily: font.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.9, textTransform: 'uppercase' },
  metric: { fontFamily: font.display, fontSize: 36, lineHeight: 42, letterSpacing: -1 },
  metricSm: { fontFamily: font.display, fontSize: 26, lineHeight: 31, letterSpacing: -0.6 },
} as const;

/*
 * Larger text (Appearance → Text size). The ramp above is the "standard"
 * size; applyTextScale rewrites it in place so every `typography.x` read
 * at render time follows. Reading styles grow by the full factor, display
 * styles by half of it so titles don't crowd the screen. Styles copied into
 * a StyleSheet at module load keep their standard size (a known ceiling).
 */
export type TextScale = 1 | 1.15 | 1.3;
export const TEXT_SCALES: TextScale[] = [1, 1.15, 1.3];
const baseTypography = JSON.parse(JSON.stringify(typography)) as Record<string, { fontSize: number; lineHeight: number }>;
const DISPLAY_STYLES = new Set(['display', 'largeTitle', 'title1', 'title2', 'metric', 'metricSm']);
export const applyTextScale = (scale: TextScale): void => {
  const target = typography as unknown as Record<string, { fontSize: number; lineHeight: number }>;
  for (const [name, base] of Object.entries(baseTypography)) {
    const k = DISPLAY_STYLES.has(name) ? 1 + (scale - 1) / 2 : scale;
    const style = target[name];
    if (!style) continue;
    style.fontSize = Math.round(base.fontSize * k);
    style.lineHeight = Math.round(base.lineHeight * k);
  }
};

/** spacing(n) = n * 4. Screen margin 20, tile gap 12, section gap 32. */
export const spacing = (n: number): number => n * 4;

/** Minimum touch target (Apple HIG). Icon buttons use 44; list rows stay taller. */
export const MIN_TOUCH_TARGET = 44;

/*
 * Motion tokens. Calm by rule: dose confirmation never bounces and
 * nothing pulses. Pick from here (via useMotion) so screens move alike.
 */
export const motion = {
  spring: {
    /** Layout shifts, progress, expanders, tab pill. */
    gentle: { damping: 20, stiffness: 180 },
    /** Press feedback, checkmarks, selection pills. */
    snappy: { damping: 18, stiffness: 350 },
    /** Tiles and heroes settling in: no overshoot. */
    settle: { damping: 26, stiffness: 170, overshootClamping: true },
  },
  duration: { fast: 150, base: 220, slow: 320 },
  /** ms between staggered list items, capped after `staggerMax` items. */
  stagger: 40,
  staggerMax: 8,
} as const;

/** Reading-column width on wide (web / tablet) viewports. */
export const CONTENT_MAX_WIDTH = 680;
