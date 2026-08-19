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
} as const;

export type HealthCategory = keyof typeof categoryColors;

export const semantic = {
  light: {
    background: '#FAFAF9',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    separator: 'rgba(92,100,111,0.22)',
    textPrimary: '#0E1218',
    textSecondary: 'rgba(92,100,111,0.9)',
    textTertiary: 'rgba(92,100,111,0.56)',
    accent: '#B4611C',
    destructive: '#A8342A',
    success: '#1F6F4A',
    warning: '#D98A3D',
  },
  dark: {
    background: '#0E1218',
    surface: '#171C24',
    surfaceRaised: '#232935',
    separator: 'rgba(217,138,61,0.24)',
    textPrimary: '#FAFAF9',
    textSecondary: 'rgba(250,250,249,0.74)',
    textTertiary: 'rgba(250,250,249,0.45)',
    accent: '#D98A3D',
    destructive: '#C45C53',
    success: '#3C9B71',
    warning: '#D98A3D',
  },
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
