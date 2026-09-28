import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimatedPressable, Button, Card, Field, Input, PageShell, Stack, font, radius, spacing, typography, useMotion, useTokens } from '@/components/ui';
import { ConfirmExpander } from '@/components/takt/confirm-expander';
import { CARE_ROLE_META } from '@/components/takt/next-visit-card';
import { CARE_ROLES, useCare, type CareRole } from '@/lib/takt/care';
import { useLocale } from '@/lib/takt/l10n';

/*
 * Add / edit a care-team contact (?id= edits). Name and role are all
 * that is needed; phone and email turn on the Call / Email buttons.
 */
export default function CareContactScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();
  const { enter } = useMotion();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const care = useCare();
  const existing = id ? care.contacts.find((x) => x.id === id) : undefined;

  const [name, setName] = useState('');
  const [role, setRole] = useState<CareRole>('doctor');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fill once the stored contact has loaded.
  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setRole(existing.role);
    setPhone(existing.phone ?? '');
    setEmail(existing.email ?? '');
    setNote(existing.note ?? '');
  }, [existing]);

  const nameError = tried && !name.trim() ? t('careRequired') : null;

  const save = async () => {
    setTried(true);
    if (!name.trim()) return;
    setError(null);
    try {
      await care.saveContact({
        id: existing?.id,
        name: name.trim(),
        role,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        note: note.trim() || undefined,
      });
      router.back();
    } catch {
      setError(t('careSaveError'));
    }
  };

  const remove = async () => {
    if (!existing) return;
    await care.deleteContact(existing.id);
    router.back();
  };

  return (
    <PageShell>
      <Stack>
        <Animated.View entering={enter(0)}>
          <Card style={styles.card}>
            <Field label={t('careNameLabel')} error={nameError}>
              <Input
                value={name}
                onChangeText={setName}
                placeholder={t('careNamePlaceholder')}
                accessibilityLabel={t('careNameLabel')}
                autoCapitalize="words"
                invalid={Boolean(nameError)}
              />
            </Field>
            <Field label={t('careRoleLabel')}>
              {/* Two tidy rows of three instead of a ragged wrap. */}
              <View style={styles.roles} accessibilityRole="radiogroup">
                {CARE_ROLES.map((r) => {
                  const on = role === r;
                  return (
                    <AnimatedPressable
                      key={r}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on, checked: on }}
                      onPress={() => setRole(r)}
                      style={[styles.role, { backgroundColor: on ? c.ink : c.surfaceRaised }]}
                    >
                      <Text numberOfLines={1} style={[typography.subhead, { color: on ? c.onInk : c.textPrimary, fontFamily: on ? font.bold : font.semibold }]}>
                        {t(CARE_ROLE_META[r].label)}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </Field>
            <Field label={t('carePhoneLabel')}>
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="+49 30 1234567"
                accessibilityLabel={t('carePhoneLabel')}
                keyboardType="phone-pad"
                autoComplete="tel"
                style={styles.tabular}
              />
            </Field>
            <Field label={t('careEmailLabel')}>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="praxis@example.com"
                accessibilityLabel={t('careEmailLabel')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </Field>
            <Field label={t('careNoteLabel')}>
              <Input value={note} onChangeText={setNote} placeholder={t('careContactNotePlaceholder')} accessibilityLabel={t('careNoteLabel')} />
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
              triggerLabel={t('careDeleteContact')}
              triggerKind="outline"
              body={t('careDeleteContactBody')}
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
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  role: { flexBasis: '30%', flexGrow: 1, minHeight: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(2) },
  tabular: { fontVariant: ['tabular-nums'] },
  actions: { gap: spacing(3) },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
});
