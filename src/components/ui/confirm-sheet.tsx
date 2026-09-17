import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { motion, spacing, typography } from '../../theme/tokens';
import { useMotion } from '../../theme/use-motion';
import { useTokens } from '../../theme/use-tokens';
import { Card } from './card';
import { Button } from './controls';

/*
 * ConfirmSheet — the inline answer to Alert.alert (a no-op on web).
 * Mount it where the confirmation belongs; it expands in place with a
 * LinearTransition so the content below slides rather than jumps.
 * Confirm is destructive by default and fires the rigid haptic.
 */
export const ConfirmSheet = ({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading = false,
  destructive = true,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  destructive?: boolean;
}) => {
  const { c } = useTokens();
  const { duration } = useMotion();

  return (
    <Animated.View
      layout={LinearTransition.springify()
        .damping(motion.spring.gentle.damping)
        .stiffness(motion.spring.gentle.stiffness)}
    >
      {open ? (
        <Animated.View
          entering={FadeIn.duration(duration.fast)}
          exiting={FadeOut.duration(duration.fast)}
          accessibilityRole="alert"
        >
          <Card style={{ borderColor: destructive ? `${c.destructive}33` : c.cardBorder }}>
            <View style={styles.body}>
              <Text style={[typography.headline, { color: c.textPrimary }]}>{title}</Text>
              {body ? <Text style={[typography.subhead, { color: c.textSecondary }]}>{body}</Text> : null}
              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button size="sm" kind="secondary" label={cancelLabel} onPress={onCancel} disabled={loading} />
                </View>
                <View style={styles.action}>
                  <Button
                    size="sm"
                    kind={destructive ? 'destructive' : 'primary'}
                    label={confirmLabel}
                    onPress={onConfirm}
                    loading={loading}
                    haptic="rigid"
                  />
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  body: { padding: spacing(4), gap: spacing(3) },
  actions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(1) },
  action: { flex: 1 },
});
