import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import {
  categoryColors as defaultCategoryColors,
  getSemanticColors,
  paletteConfigs,
  type CategoryColors,
  type ThemeMode,
  type ThemePalette,
} from './tokens';

const STORAGE_THEME_MODE_KEY = 'takt:theme-mode:v1';
const STORAGE_PALETTE_KEY = 'takt:theme-palette:v1';

type ThemeContextValue = {
  themeMode: ThemeMode;
  palette: ThemePalette;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setPalette: (palette: ThemePalette) => Promise<void>;
  isDark: boolean;
  scheme: 'light' | 'dark';
  c: ReturnType<typeof getSemanticColors>;
  paletteConfig: (typeof paletteConfigs)[ThemePalette];
  categoryColors: CategoryColors;
  /** False until the persisted mode/palette have been read. */
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [palette, setPaletteState] = useState<ThemePalette>('amber');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [savedMode, savedPalette] = await Promise.all([
          AsyncStorage.getItem(STORAGE_THEME_MODE_KEY),
          AsyncStorage.getItem(STORAGE_PALETTE_KEY),
        ]);
        if (!active) return;
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setThemeModeState(savedMode);
        }
        if (
          savedPalette === 'amber' ||
          savedPalette === 'sage' ||
          savedPalette === 'indigo' ||
          savedPalette === 'plum'
        ) {
          setPaletteState(savedPalette);
        }
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setThemeMode = useCallback(async (nextMode: ThemeMode) => {
    setThemeModeState(nextMode);
    await AsyncStorage.setItem(STORAGE_THEME_MODE_KEY, nextMode);
  }, []);

  const setPalette = useCallback(async (nextPalette: ThemePalette) => {
    setPaletteState(nextPalette);
    await AsyncStorage.setItem(STORAGE_PALETTE_KEY, nextPalette);
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [systemScheme, themeMode]);

  const scheme: 'light' | 'dark' = isDark ? 'dark' : 'light';

  const c = useMemo(() => getSemanticColors(scheme, palette), [palette, scheme]);

  const paletteConfig = useMemo(() => paletteConfigs[palette] ?? paletteConfigs.amber, [palette]);

  const dynamicCategoryColors = useMemo(
    () => ({
      ...defaultCategoryColors,
      medication: c.accent,
    }),
    [c.accent],
  );

  const value = useMemo(
    () => ({
      themeMode,
      palette,
      setThemeMode,
      setPalette,
      isDark,
      scheme,
      c,
      paletteConfig,
      categoryColors: dynamicCategoryColors,
      hydrated,
    }),
    [themeMode, palette, setThemeMode, setPalette, isDark, scheme, c, paletteConfig, dynamicCategoryColors, hydrated],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  const systemScheme = useColorScheme();

  if (!ctx) {
    const isDark = systemScheme === 'dark';
    const scheme: 'light' | 'dark' = isDark ? 'dark' : 'light';
    const c = getSemanticColors(scheme, 'amber');
    return {
      themeMode: 'system',
      palette: 'amber',
      setThemeMode: async () => undefined,
      setPalette: async () => undefined,
      isDark,
      scheme,
      c,
      paletteConfig: paletteConfigs.amber,
      categoryColors: {
        ...defaultCategoryColors,
        medication: c.accent,
      },
      hydrated: true,
    };
  }

  return ctx;
}
