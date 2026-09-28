import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextInputProps } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedPressable,
  INK,
  Input,
  MIN_TOUCH_TARGET,
  TaktMark,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
  font,
} from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

/*
 * Shared auth chrome: brand lead, password field with visibility toggle,
 * inline banner, and text links. Presentation only; screens keep their
 * own submit logic.
 */

/** Brand lead: the Takt mark, a display headline and one calm line. */
export const AuthHero = ({ title, description }: { title: string; description: string }) => {
  const { c } = useTokens();
  const { reduce } = useMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.duration(420)} style={styles.hero}>
      <View style={styles.brand}>
        <TaktMark size={36} />
        <Text style={[styles.wordmark, { color: c.textPrimary }]}>
          takt<Text style={{ color: c.accent }}>.</Text>
        </Text>
      </View>
      <Text accessibilityRole="header" style={[typography.largeTitle, { color: c.textPrimary }]}>
        {title}
      </Text>
      <Text style={[typography.body, { color: c.textSecondary }]}>{description}</Text>
    </Animated.View>
  );
};

/** Staggered block for a form section, so the page assembles in reading order. */
export const AuthBlock = ({ index, children }: { index: number; children: ReactNode }) => {
  const { enter } = useMotion();
  return (
    <Animated.View entering={enter(index)} style={styles.block}>
      {children}
    </Animated.View>
  );
};

export const PasswordInput = ({ style, ...props }: TextInputProps & { invalid?: boolean }) => {
  const { c } = useTokens();
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? t('authHidePassword') : t('authShowPassword');
  return (
    <View>
      <Input {...props} secureTextEntry={!visible} style={[{ paddingRight: MIN_TOUCH_TARGET + spacing(3) }, style]} />
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={toggleLabel}
        haptic="light"
        scaleTo={0.9}
        onPress={() => setVisible((v) => !v)}
        style={styles.eye}
      >
        <View style={[styles.eyeCircle, { backgroundColor: c.surfaceRaised }]}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.textPrimary} />
        </View>
      </AnimatedPressable>
    </View>
  );
};

export const AuthBanner = ({ tone, message }: { tone: 'destructive' | 'success'; message: string }) => {
  const { c } = useTokens();
  const { duration } = useMotion();
  const t = tone === 'success' ? c.tones.sage : c.tones.rose;
  return (
    <Animated.View
      entering={FadeIn.duration(duration.base)}
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: t.bg }]}
    >
      <Ionicons name={tone === 'success' ? 'checkmark-circle' : 'alert-circle'} size={20} color={t.fg} />
      <Text style={[typography.subhead, { color: INK, flex: 1 }]}>{message}</Text>
    </Animated.View>
  );
};

/** "Prompt? Link" row, e.g. "New to Takt? Create account". */
export const AuthLinkRow = ({
  prompt,
  label,
  onPress,
  align = 'center',
}: {
  prompt?: string;
  label: string;
  onPress: () => void;
  align?: 'center' | 'flex-end';
}) => {
  const { c } = useTokens();
  return (
    <View style={[styles.linkRow, { justifyContent: align }]}>
      {prompt ? <Text style={[typography.body, { color: c.textSecondary }]}>{prompt}</Text> : null}
      <AnimatedPressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={styles.link}>
        <Text style={[typography.body, styles.linkText, { color: c.textPrimary, fontFamily: font.semibold }]}>{label}</Text>
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { gap: spacing(2), paddingTop: spacing(1) },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginBottom: spacing(3) },
  wordmark: { fontFamily: font.displayHeavy, fontSize: 24, lineHeight: 28, letterSpacing: -0.8 },
  block: { gap: spacing(4) },
  eye: {
    position: 'absolute',
    right: spacing(1),
    top: 0,
    bottom: 0,
    width: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    padding: spacing(3.5),
    borderRadius: radius.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing(1.5),
  },
  link: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing(1),
  },
  linkText: { textDecorationLine: 'underline' },
});
