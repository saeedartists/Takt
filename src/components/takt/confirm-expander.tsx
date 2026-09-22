import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
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
  triggerKind?: 'secondary' | 'destructive';
  confirmLabel?: string;
  body: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTokens();
  const { t } = useLocale();
  const { duration } = useMotion();
  return (
    <Animated.View layout={LinearTransition}>
      {open ? (
        <Animated.View entering={FadeIn.duration(duration.fast)} style={{ gap: spacing(3) }}>
          <Text style={[typography.subhead, { color: c.textPrimary }]}>{body}</Text>
          <View style={styles.confirmRow}>
            <View style={{ flex: 1 }}>
              <Button kind="secondary" label={t('cancel')} onPress={onCancel} disabled={loading} />
            </View>
            <View style={{ flex: 1 }}>
              <Button kind="destructive" label={confirmLabel ?? triggerLabel} onPress={onConfirm} loading={loading} />
            </View>
          </View>
        </Animated.View>
      ) : (
        <Button kind={triggerKind} label={triggerLabel} onPress={onOpen} disabled={disabled} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  confirmRow: { flexDirection: 'row', gap: spacing(2) },
});
