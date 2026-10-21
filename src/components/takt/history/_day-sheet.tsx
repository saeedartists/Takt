import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  CONTENT_MAX_WIDTH,
  font,
  radius,
  spacing,
  typography,
} from '@/components/ui';
import { MedicationGlyph } from '@/components/takt/medication-glyph';
import { useLocale } from '@/lib/takt/l10n';
import type { HistoryDay } from '@/lib/takt/schedule';
import type { DoseOccurrence, MedicationPlan } from '@/lib/takt/types';
import type { BadgeTone, IconName } from '@/components/ui';
import { useTokens } from '@/theme/use-tokens';
import { STATE_META } from './_history-shared';

/** One day's doses, read-only; corrections stay in "Fix a logged dose". */
export const DaySheet = ({
  day,
  planById,
  onClose,
}: {
  day: HistoryDay | null;
  planById: Map<string, MedicationPlan>;
  onClose: () => void;
}) => {
  const { c } = useTokens();
  const { t, formatDate, formatTime } = useLocale();
  const insets = useSafeAreaInsets();
  if (!day) return null;

  const status = (state: DoseOccurrence['state']): { label: string; tone: BadgeTone; icon: IconName } =>
    state === 'taken' || state === 'skipped' || state === 'missed'
      ? {
          label: state === 'taken' ? t('statusTaken') : state === 'skipped' ? t('statusSkipped') : t('statusMissed'),
          tone: STATE_META[state].badge,
          icon: STATE_META[state].icon,
        }
      : state === 'due'
        ? { label: t('statusDue'), tone: 'accent', icon: 'alarm-outline' }
        : { label: t('statusScheduled'), tone: 'info', icon: 'time-outline' };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetWrap}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(21,23,28,0.45)' }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('calendarClose')}
        />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: spacing(4) + insets.bottom }]}>
          <View style={[styles.handle, { backgroundColor: c.separator }]} />
          <Text accessibilityRole="header" style={[typography.title2, { color: c.textPrimary }]}>
            {formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Text style={[typography.subhead, { color: c.textSecondary, fontVariant: ['tabular-nums' as const] }]}>
            {t('takenOfTotal').replace('{taken}', String(day.taken)).replace('{total}', String(day.doses.length))}
          </Text>
          <View style={styles.sheetList}>
            {day.doses.map((dose, index) => {
              const plan = planById.get(dose.requestId);
              const meta = status(dose.state);
              return (
                <View
                  key={dose.id}
                  accessible
                  accessibilityLabel={`${dose.label}, ${formatTime(dose.scheduledAt)}, ${meta.label}`}
                  style={[styles.sheetRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}
                >
                  <MedicationGlyph appearance={plan?.appearance} form={plan?.form} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[typography.headline, { color: c.textPrimary }]}>
                      {dose.label}
                    </Text>
                    <Text style={[typography.subhead, { color: c.textSecondary, fontVariant: ['tabular-nums' as const] }]}>
                      {formatTime(dose.scheduledAt)}
                    </Text>
                  </View>
                  <View>
                    <Badge label={meta.label} tone={meta.tone} icon={meta.icon} size="sm" />
                  </View>
                </View>
              );
            })}
          </View>
          <Button kind="secondary" label={t('calendarClose')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(2),
    gap: spacing(1),
  },
  handle: { width: 36, height: 4, borderRadius: radius.full, alignSelf: 'center', marginBottom: spacing(3) },
  sheetList: { marginTop: spacing(2), marginBottom: spacing(4) },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), minHeight: 60, paddingVertical: spacing(2) },
});
