/*
 * Design tokens — Apple Health visual language, mobile mirror.
 *
 * Deliberately hand-mirrored from the web scaffold's app/globals.css
 * rather than shared: scaffolds are standalone (no workspace deps), and
 * RN has no CSS custom properties. The VALUES must stay in sync with
 * the web copy — same iOS system palette, same Health category
 * colours — so a chat that builds both surfaces gets one product, not
 * two that merely rhyme.
 *
 * Palette values are iOS system colours. Do not invent new hexes; pick
 * from here, and if a tenant rebrands, override `semantic` only.
 */

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

/*
 * Health category colours. Same values in both schemes — the whole
 * point is that "heart data is this red" is a stable association.
 */
export const categoryColors = {
  heart: '#FF375F',
  activity: '#FF9500',
  sleep: '#40C8E0',
  nutrition: '#34C759',
  medication: '#B4611C',
  mindfulness: '#5E5CE6',
  body: '#AF52DE',
  respiratory: '#64D2FF',
  lab: '#007AFF',
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
    medicationLight: string;
    medicationDark: string;
    previewColor: string;
  }
> = {
  amber: {
    name: 'Takt Amber',
    description: 'Warm terracotta & sunlit calm',
    nameKey: 'themeAmberName',
    descriptionKey: 'themeAmberDesc',
    accentLight: '#B4611C',
    accentDark: '#E07D2C',
    medicationLight: '#B4611C',
    medicationDark: '#E07D2C',
    previewColor: '#B4611C',
  },
  sage: {
    name: 'Nordic Sage',
    description: 'Serene forest & restorative calm',
    nameKey: 'themeSageName',
    descriptionKey: 'themeSageDesc',
    accentLight: '#23704B',
    accentDark: '#3DB87E',
    medicationLight: '#23704B',
    medicationDark: '#3DB87E',
    previewColor: '#23704B',
  },
  indigo: {
    name: 'Ocean Slate',
    description: 'Crisp medical indigo & clarity',
    nameKey: 'themeIndigoName',
    descriptionKey: 'themeIndigoDesc',
    accentLight: '#1D63D8',
    accentDark: '#4D90FE',
    medicationLight: '#1D63D8',
    medicationDark: '#4D90FE',
    previewColor: '#1D63D8',
  },
  plum: {
    name: 'Velvet Plum',
    description: 'Gentle berry & mindful presence',
    nameKey: 'themePlumName',
    descriptionKey: 'themePlumDesc',
    accentLight: '#853982',
    accentDark: '#BF66B9',
    medicationLight: '#853982',
    medicationDark: '#BF66B9',
    previewColor: '#853982',
  },
};

export const getSemanticColors = (scheme: 'light' | 'dark', palette: ThemePalette = 'amber') => {
  const p = paletteConfigs[palette] ?? paletteConfigs.amber;
  const accent = scheme === 'light' ? p.accentLight : p.accentDark;

  if (scheme === 'light') {
    return {
      background: '#F9F8F5',
      surface: '#FFFFFF',
      surfaceRaised: '#F1EFEB',
      surfaceSubtle: '#FAF9F6',
      separator: 'rgba(92,100,111,0.18)',
      cardBorder: 'rgba(0,0,0,0.06)',
      textPrimary: '#12171E',
      textSecondary: 'rgba(68,76,86,0.88)',
      textTertiary: 'rgba(92,100,111,0.52)',
      accent,
      destructive: '#B83226',
      success: '#1B7248',
      warning: '#C97726',
    };
  }

  return {
    background: '#0B0F15',
    surface: '#151A22',
    surfaceRaised: '#1E2530',
    surfaceSubtle: '#12161E',
    separator: 'rgba(255,255,255,0.12)',
    cardBorder: 'rgba(255,255,255,0.08)',
    textPrimary: '#F8FAFC',
    textSecondary: 'rgba(241,245,249,0.76)',
    textTertiary: 'rgba(241,245,249,0.48)',
    accent,
    destructive: '#E5534B',
    success: '#34D399',
    warning: '#F59E0B',
  };
};

export const semantic = {
  light: getSemanticColors('light', 'amber'),
  dark: getSemanticColors('dark', 'amber'),
} as const;

/** Corner radii — Health uses generous corners; 16 is the card value. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

/*
 * iOS type ramp. Names match Apple's text styles so a HIG reference
 * maps directly to a token. `metric` is the big number on a tile.
 */
export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  metric: { fontSize: 40, lineHeight: 44, fontWeight: '700' },
  metricSm: { fontSize: 28, lineHeight: 32, fontWeight: '700' },
} as const;

/** Matches the SDK's DEFAULT_MULTIPLIERS.spacing — spacing(n) = n * 4. */
export const spacing = (n: number): number => n * 4;

/** Minimum touch target per Apple HIG. Do not go below this. */
export const MIN_TOUCH_TARGET = 44;

/*
 * Motion tokens. Two springs and three durations cover every animation
 * in the app; pick from here (via useMotion) so screens move the same way.
 */
export const motion = {
  spring: {
    /** Layout shifts, progress, expanders. */
    gentle: { damping: 20, stiffness: 180 },
    /** Press feedback, checkmarks, selection pills. */
    snappy: { damping: 18, stiffness: 350 },
  },
  duration: { fast: 150, base: 220, slow: 320 },
  /** ms between staggered list items, capped after `staggerMax` items. */
  stagger: 40,
  staggerMax: 8,
} as const;

/** Reading-column width on wide (web / tablet) viewports. */
export const CONTENT_MAX_WIDTH = 680;
