import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Button, spacing, typography, useMotion, useTokens } from '@/components/ui';
import { useLocale } from '@/lib/takt/l10n';

/** Two-step destructive action: trigger button, then an inline confirm row. No Alert.alert (a no-op on web). */
export function ConfirmExpander({
  open,
  onOpen,
  onCancel,
  onConfirm,
  triggerLabel,
  triggerKind = 'secondary',
  /** Short label for the confirm button when the trigger label is long. */
  confirmLabel,
  body,
  loading = false,
  disabled = false,
}: {
  open: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  triggerLabel: string;
  triggerKind?: 'secondary' | 'outline' | 'destructive';
  confirmLabel?: string;
  body: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTokens();
  const { t } = useLocale();
  const { duration } = useMotion();
  // Timed, not sprung: a destructive confirm should settle, never bounce.
  return (
    <Animated.View layout={LinearTransition.duration(duration.base)}>
      {open ? (
        <Animated.View
          entering={FadeInDown.duration(duration.base)}
          exiting={FadeOut.duration(duration.fast)}
          style={styles.panel}
        >
          <Text style={[typography.body, { color: c.textPrimary }]}>{body}</Text>
          <View style={styles.confirmRow}>
            <View style={styles.flex}>
              <Button kind="secondary" label={t('cancel')} onPress={onCancel} disabled={loading} />
            </View>
            <View style={styles.flex}>
              <Button kind="destructive" label={confirmLabel ?? triggerLabel} onPress={onConfirm} loading={loading} />
            </View>
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(duration.fast)}>
          <Button kind={triggerKind} label={triggerLabel} onPress={onOpen} disabled={disabled} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing(3) },
  confirmRow: { flexDirection: 'row', gap: spacing(2) },
  flex: { flex: 1 },
});
