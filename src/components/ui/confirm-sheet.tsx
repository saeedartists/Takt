import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { spacing, typography } from '../../theme/tokens';
import { useMotion } from '../../theme/use-motion';
import { useTokens } from '../../theme/use-tokens';
import { Card } from './card';
import { Button } from './controls';

/*
 * ConfirmSheet — the inline answer to Alert.alert (a no-op on web).
 * Mount it where the confirmation belongs; it slides open in place with
 * a timed LinearTransition so the content below glides rather than
 * jumps (no spring: a destructive confirm should never bounce).
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
    <Animated.View layout={LinearTransition.duration(duration.base)}>
      {open ? (
        <Animated.View
          entering={FadeInDown.duration(duration.base)}
          exiting={FadeOut.duration(duration.fast)}
          accessibilityRole="alert"
        >
          <Card>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: destructive ? c.tones.rose.bg : c.surfaceRaised },
                  ]}
                >
                  <Ionicons
                    name={destructive ? 'alert-circle-outline' : 'help-circle-outline'}
                    size={22}
                    color={destructive ? c.tones.rose.fg : c.textPrimary}
                  />
                </View>
                <Text style={[typography.title3, styles.title, { color: c.textPrimary }]}>{title}</Text>
              </View>
              {body ? <Text style={[typography.body, { color: c.textSecondary }]}>{body}</Text> : null}
              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button kind="secondary" label={cancelLabel} onPress={onCancel} disabled={loading} />
                </View>
                <View style={styles.action}>
                  <Button
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
  body: { padding: spacing(4.5), gap: spacing(3) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(1) },
  action: { flex: 1 },
});
