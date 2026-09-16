import { iosPalette } from './tokens';
import { useTheme } from './theme-context';

/*
 * useTokens — resolve the scheme-dependent half of the token set.
 *
 * Fully integrated with ThemeContext: returns active dynamic semantic colors,
 * palette, and scheme (light/dark) reflecting user preference.
 */
export const useTokens = () => {
  const { scheme, c, isDark, paletteConfig, palette: currentPalette } = useTheme();

  return {
    scheme,
    isDark,
    c,
    palette: iosPalette[scheme],
    paletteName: currentPalette,
    paletteConfig,
  } as const;
};

