import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  AnimatedPressable,
  AnimatedSegmentedControl,
  Card,
  INK,
  PAPER,
  PageShell,
  PillIcon,
  Stack,
  font,
  paletteConfigs,
  radius,
  spacing,
  typography,
  useMotion,
  useTheme,
  useTokens,
  type ThemeMode,
  type ThemePalette,
} from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

const PALETTES = Object.keys(paletteConfigs) as ThemePalette[];
const MODES: ThemeMode[] = ['system', 'light', 'dark'];

/** Small bold label above a group, as in the brand canvas. */
const GroupLabel = ({ children }: { children: string }) => {
  const { c } = useTokens();
  return (
    <Text accessibilityRole="header" style={[typography.headline, styles.groupLabel, { color: c.textPrimary }]}>
      {children}
    </Text>
  );
};

/** A radio card whose selection ring fades/scales in and whose check badge zooms in. */
function OptionCard({
  selected,
  onPress,
  label,
  style,
  radiusSize,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  style: StyleProp<ViewStyle>;
  radiusSize: number;
  children: ReactNode;
}) {
  const { c } = useTokens();
  const { duration } = useMotion();
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: duration.base });
  }, [on, selected, duration.base]);
  const ring = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scale: 1.04 - on.value * 0.04 }] }));

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      haptic="light"
      scaleTo={0.97}
      onPress={onPress}
      style={[style, { borderRadius: radiusSize }]}
    >
      {children}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radiusSize, borderWidth: 3, borderColor: c.textPrimary }, ring]}
      />
    </AnimatedPressable>
  );
}

const CheckBadge = () => {
  const { reduce } = useMotion();
  return (
    <Animated.View
      entering={reduce ? undefined : ZoomIn.duration(220)}
      exiting={FadeOut.duration(120)}
      style={styles.check}
    >
      <Ionicons name="checkmark" size={16} color={PAPER} />
    </Animated.View>
  );
};

/** A tiny rendering of the scheme: ground, a card and a pastel tile. */
const SchemeSwatch = ({ mode }: { mode: ThemeMode }) => {
  const { c } = useTokens();
  const half = (dark: boolean) => (
    <View style={[styles.swatchHalf, { backgroundColor: dark ? '#0F1115' : PAPER }]}>
      <View style={[styles.swatchCard, { backgroundColor: dark ? '#1A1D23' : '#FFFFFF' }]} />
      <View style={[styles.swatchTile, { backgroundColor: c.accentSoft }]} />
    </View>
  );
  return (
    <View style={[styles.swatch, { borderColor: c.separator }]}>
      {mode === 'system' ? (
        <>
          {half(false)}
          {half(true)}
        </>
      ) : (
        half(mode === 'dark')
      )}
    </View>
  );
};

/** Live preview: re-tints smoothly as the palette changes. */
function PalettePreview() {
  const { c, isDark } = useTokens();
  const { t } = useLocale();
  const { duration } = useMotion();
  const soft = useSharedValue(c.accentSoft);
  const deep = useSharedValue(c.onAccentSoft);
  useEffect(() => {
    soft.value = withTiming(c.accentSoft, { duration: duration.slow });
    deep.value = withTiming(c.onAccentSoft, { duration: duration.slow });
  }, [c.accentSoft, c.onAccentSoft, deep, soft, duration.slow]);
  const tile = useAnimatedStyle(() => ({ backgroundColor: soft.value }));
  const tabPill = useAnimatedStyle(() => ({ backgroundColor: soft.value }));
  const deepText = useAnimatedStyle(() => ({ color: deep.value }));

  return (
    <Card>
      <View style={styles.preview} accessible accessibilityLabel={t('appearancePreview')}>
        <Text style={[typography.caption, { color: c.textSecondary }]}>{t('appearancePreview')}</Text>
        <Animated.View style={[styles.previewTile, tile]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Animated.Text style={[typography.caption, { fontFamily: font.bold }, deepText]}>{t('nextDose')}</Animated.Text>
            <Text style={[typography.metricSm, { color: INK }]}>08:00</Text>
            <Text style={[typography.subhead, { color: INK }]}>Ramipril · 5 mg</Text>
          </View>
          <View style={styles.previewIcon}>
            <PillIcon size={22} color={INK} />
          </View>
        </Animated.View>
        <View style={styles.previewRow}>
          <View style={[styles.previewChip, { backgroundColor: c.tones.sage.bg }]}>
            <Ionicons name="checkmark-circle" size={16} color={c.tones.sage.fg} />
            <Text style={[typography.caption, { color: c.tones.sage.fg, fontFamily: font.bold }]}>{t('statusTaken')}</Text>
          </View>
          <View style={[styles.previewBar, { backgroundColor: isDark ? c.background : c.chrome }]}>
            <View style={[styles.previewDot, { backgroundColor: c.onChrome }]} />
            <View style={[styles.previewDot, { backgroundColor: c.onChrome }]} />
            <Animated.View style={[styles.previewActive, tabPill]} />
          </View>
        </View>
      </View>
    </Card>
  );
}

export default function AppearanceSettingsScreen() {
  const { c, isDark } = useTokens();
  const { enter } = useMotion();
  const { themeMode, setThemeMode, palette, setPalette } = useTheme();
  const { locale, setLocale, t } = useLocale();

  const modeLabel = (mode: ThemeMode) =>
    mode === 'light' ? t('themeModeLight') : mode === 'dark' ? t('themeModeDark') : t('themeModeSystem');

  return (
    <PageShell>
      <Stack>
        <Animated.View entering={enter(0)}>
          <Text accessibilityRole="header" style={[typography.title2, { color: c.textPrimary }]}>
            {t('appearanceLead')}
          </Text>
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.group}>
          <GroupLabel>{t('themePalette')}</GroupLabel>
          <View accessibilityRole="radiogroup" style={styles.paletteGrid}>
            {PALETTES.map((key) => {
              const p = paletteConfigs[key];
              const selected = palette === key;
              return (
                <OptionCard
                  key={key}
                  selected={selected}
                  onPress={() => void setPalette(key)}
                  label={t(p.nameKey)}
                  radiusSize={radius.xl}
                  style={[styles.paletteCard, { backgroundColor: isDark ? p.softDark : p.softLight }]}
                >
                  <View style={styles.paletteTop}>
                    <View style={[styles.paletteDot, { backgroundColor: p.accentLight }]} />
                    {selected ? <CheckBadge /> : null}
                  </View>
                  <View>
                    <Text style={[typography.headline, { color: INK, fontFamily: font.bold }]}>{t(p.nameKey)}</Text>
                    <Text style={[typography.footnote, { color: p.onSoft }]}>{t(p.descriptionKey)}</Text>
                  </View>
                </OptionCard>
              );
            })}
          </View>
          <Text style={[typography.footnote, { color: c.textTertiary }]}>{t('themePaletteHint')}</Text>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <PalettePreview />
        </Animated.View>

        <Animated.View entering={enter(3)} style={styles.group}>
          <GroupLabel>{t('themeMode')}</GroupLabel>
          <View accessibilityRole="radiogroup" style={styles.modeRow}>
            {MODES.map((mode) => (
              <OptionCard
                key={mode}
                selected={themeMode === mode}
                onPress={() => void setThemeMode(mode)}
                label={modeLabel(mode)}
                radiusSize={radius.lg}
                style={[styles.modeCard, { backgroundColor: c.surface }]}
              >
                <SchemeSwatch mode={mode} />
                <Text
                  style={[
                    typography.subhead,
                    { color: c.textPrimary, fontFamily: themeMode === mode ? font.bold : font.semibold },
                  ]}
                >
                  {modeLabel(mode)}
                </Text>
              </OptionCard>
            ))}
          </View>
          <Text style={[typography.footnote, { color: c.textTertiary }]}>{t('themeModeHint')}</Text>
        </Animated.View>

        <Animated.View entering={enter(4)} style={styles.group}>
          <GroupLabel>{t('language')}</GroupLabel>
          <AnimatedSegmentedControl
            track="surface"
            value={locale}
            onChange={(next) => void setLocale(next as 'de' | 'en')}
            options={[
              { value: 'en', label: 'English' },
              { value: 'de', label: 'Deutsch' },
            ]}
          />
        </Animated.View>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing(3) },
  groupLabel: { paddingHorizontal: spacing(1) },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3) },
  paletteCard: { flexBasis: '46%', flexGrow: 1, padding: spacing(3.5), gap: spacing(2.5) },
  paletteTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paletteDot: { width: 28, height: 28, borderRadius: 14 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { padding: spacing(4), gap: spacing(3) },
  previewTile: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, paddingVertical: spacing(3), paddingHorizontal: spacing(4), gap: spacing(3) },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(3) },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    minHeight: 32,
    paddingHorizontal: spacing(3),
    borderRadius: radius.full,
  },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    height: 40,
    paddingHorizontal: spacing(3),
    borderRadius: radius.full,
  },
  previewDot: { width: 8, height: 8, borderRadius: 4 },
  previewActive: { width: 44, height: 28, borderRadius: 14 },
  modeRow: { flexDirection: 'row', gap: spacing(2.5) },
  modeCard: { flex: 1, padding: spacing(2.5), gap: spacing(2), alignItems: 'center', minHeight: 48 },
  swatch: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
  },
  swatchHalf: { flex: 1, padding: spacing(1.5), gap: spacing(1) },
  swatchCard: { height: 14, borderRadius: 5 },
  swatchTile: { height: 14, width: '70%', borderRadius: 5 },
});
