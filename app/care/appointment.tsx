import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button, Card, Field, Input, PageShell, Stack, spacing, typography, useMotion, useTokens } from '@/components/ui';
import { ConfirmExpander } from '@/components/takt/confirm-expander';
import { Chip } from '@/components/takt/medication-form';
import { TimeField } from '@/components/takt/time-field';
import { useCare } from '@/lib/takt/care';
import { useLocale } from '@/lib/takt/l10n';
import { isoDateKey } from '@/lib/takt/time';

const isDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: string): boolean => /^\d{2}:\d{2}$/.test(v);

/*
 * Add / edit an appointment (?id= edits). What, when and with whom;
 * place and note are optional. Date and time use the system pickers.
 */
export default function CareAppointmentScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();
  const { enter } = useMotion();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const care = useCare();
  const existing = id ? care.appointments.find((x) => x.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [contactId, setContactId] = useState<string | undefined>(undefined);
  const [date, setDate] = useState(() => isoDateKey(new Date()));
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setContactId(existing.contactId);
    setDate(existing.date);
    setTime(existing.time ?? '');
    setPlace(existing.place ?? '');
    setNote(existing.note ?? '');
  }, [existing]);

  const titleError = tried && !title.trim() ? t('careRequired') : null;
  const dateError = tried && !isDate(date) ? t('careRequired') : null;

  const save = async () => {
    setTried(true);
    if (!title.trim() || !isDate(date)) return;
    setError(null);
    try {
      await care.saveAppointment({
        id: existing?.id,
        title: title.trim(),
        contactId,
        date,
        time: isTime(time) ? time : undefined,
        place: place.trim() || undefined,
        note: note.trim() || undefined,
      });
      router.back();
    } catch {
      setError(t('careSaveError'));
    }
  };

  const remove = async () => {
    if (!existing) return;
    await care.deleteAppointment(existing.id);
    router.back();
  };

  return (
    <PageShell>
      <Stack>
        <Animated.View entering={enter(0)}>
          <Card style={styles.card}>
            <Field label={t('careTitleLabel')} error={titleError}>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder={t('careTitlePlaceholder')}
                accessibilityLabel={t('careTitleLabel')}
                invalid={Boolean(titleError)}
              />
            </Field>
            {care.contacts.length ? (
              <Field label={t('careWithLabel')}>
                <View style={styles.chips} accessibilityRole="radiogroup">
                  <Chip label={t('careWithNobody')} selected={!contactId} onPress={() => setContactId(undefined)} />
                  {care.contacts.map((x) => (
                    <Chip key={x.id} label={x.name} selected={contactId === x.id} onPress={() => setContactId(x.id)} />
                  ))}
                </View>
              </Field>
            ) : null}
            <View style={styles.pair}>
              <View style={styles.flex}>
                <Field label={t('careDateLabel')} error={dateError}>
                  <TimeField mode="date" value={date} onChange={setDate} accessibilityLabel={t('careDateLabel')} invalid={Boolean(dateError)} />
                </Field>
              </View>
              <View style={styles.flex}>
                <Field label={t('careTimeLabel')}>
                  <TimeField mode="time" value={time} onChange={setTime} accessibilityLabel={t('careTimeLabel')} />
                </Field>
              </View>
            </View>
            <Field label={t('carePlaceLabel')}>
              <Input value={place} onChangeText={setPlace} placeholder={t('carePlacePlaceholder')} accessibilityLabel={t('carePlaceLabel')} />
            </Field>
            <Field label={t('careNoteLabel')}>
              <Input
                value={note}
                onChangeText={setNote}
                placeholder={t('careAppointmentNotePlaceholder')}
                accessibilityLabel={t('careNoteLabel')}
                multiline
                style={styles.note}
              />
            </Field>
          </Card>
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.actions}>
          {error ? (
            <View accessibilityRole="alert" style={styles.error}>
              <Ionicons name="alert-circle" size={16} color={c.destructive} />
              <Text style={[typography.footnote, { color: c.destructive, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}
          <Button
            size="lg"
            label={existing ? t('saveChanges') : t('save')}
            icon={<Ionicons name="checkmark" size={22} color={c.onInk} />}
            haptic="success"
            loading={care.isSaving}
            onPress={() => void save()}
          />
          {existing ? (
            <ConfirmExpander
              open={confirmDelete}
              onOpen={() => setConfirmDelete(true)}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={() => void remove()}
              triggerLabel={t('careDeleteAppointment')}
              triggerKind="outline"
              body={t('careDeleteAppointmentBody')}
              loading={care.isSaving}
            />
          ) : null}
        </Animated.View>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing(4), gap: spacing(4) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  // Side by side on web; stacked on native so the iOS wheel gets the full width.
  pair: { flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: spacing(Platform.OS === 'web' ? 3 : 4) },
  flex: { flex: 1, minWidth: 0 },
  note: { minHeight: 88, paddingTop: spacing(3.5), textAlignVertical: 'top' },
  actions: { gap: spacing(3) },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
});
