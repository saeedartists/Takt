import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputProps } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedPressable,
  Input,
  MIN_TOUCH_TARGET,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

/*
 * Shared auth chrome: brand hero, password field with visibility toggle,
 * inline banner, and text links. Presentation only; screens keep their
 * own submit logic.
 */

export const AuthHero = ({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) => {
  const { c } = useTokens();
  return (
    <View style={styles.hero}>
      <View style={[styles.logoCircle, { backgroundColor: `${c.accent}1A`, borderColor: `${c.accent}33` }]}>
        <Ionicons name={icon} size={32} color={c.accent} />
      </View>
      <Text style={[typography.title1, { color: c.textPrimary }]}>{title}</Text>
      <Text style={[typography.subhead, { color: c.textSecondary, textAlign: 'center' }]}>{description}</Text>
    </View>
  );
};

export const PasswordInput = ({ style, ...props }: TextInputProps & { invalid?: boolean }) => {
  const { c } = useTokens();
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? t('authHidePassword') : t('authShowPassword');
  return (
    <View>
      <Input {...props} secureTextEntry={!visible} style={[{ paddingRight: MIN_TOUCH_TARGET }, style]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={toggleLabel}
        onPress={() => setVisible((v) => !v)}
        style={styles.eye}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.textSecondary} />
      </Pressable>
    </View>
  );
};

export const AuthBanner = ({ tone, message }: { tone: 'destructive' | 'success'; message: string }) => {
  const { c } = useTokens();
  const { duration } = useMotion();
  const color = tone === 'success' ? c.success : c.destructive;
  return (
    <Animated.View
      entering={FadeIn.duration(duration.base)}
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: `${color}14`, borderColor: `${color}33` }]}
    >
      <Ionicons name={tone === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={18} color={color} />
      <Text style={[typography.footnote, { color: c.textPrimary, flex: 1 }]}>{message}</Text>
    </Animated.View>
  );
};

/** "Prompt? Link" row, e.g. "New to Takt? Create account". */
export const AuthLinkRow = ({ prompt, label, onPress }: { prompt?: string; label: string; onPress: () => void }) => {
  const { c } = useTokens();
  return (
    <View style={styles.linkRow}>
      {prompt ? <Text style={[typography.subhead, { color: c.textSecondary }]}>{prompt}</Text> : null}
      <AnimatedPressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={styles.link}>
        <Text style={[typography.subhead, { color: c.accent, fontWeight: '600' }]}>{label}</Text>
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingVertical: spacing(3),
    gap: spacing(1.5),
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: spacing(1),
  },
  eye: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    padding: spacing(3),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing(1.5),
  },
  link: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing(1),
  },
});
