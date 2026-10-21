import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  INK,
  Input,
  PageShell,
  TaktMark,
  font,
  radius,
  spacing,
  typography,
  useMotion,
  type IconName,
  type ToneName,
} from '@/components/ui';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useEnsurePatient, useRecordConsent, useUpdatePatient } from '@/lib/hooks/use-takt-mutations';
import { CONSENT_STORAGE_KEY, TOUR_SEEN_STORAGE_KEY } from '@/lib/takt/constants';
import { useLocale } from '@/lib/takt/l10n';
import { requestReminderPermissionsAtConsent } from '@/lib/takt/reminders';
import { useTokens } from '@/theme/use-tokens';

/*
 * First-launch health-data consent: the brand lead (mark + display
 * headline), three plain points in tinted circles, the safety line, and
 * one ink call to action.
 */
export default function ConsentScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { c } = useTokens();
  const { enter, stagger, reduce } = useMotion();
  const patient = usePrimaryPatient();
  const ensurePatient = useEnsurePatient();
  const updatePatient = useUpdatePatient();
  const consent = useRecordConsent();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Prefill the name once the patient profile arrives, but never over user edits
  // (a partial re-consent must not wipe the stored name).
  const nameEdited = useRef(false);

  useEffect(() => {
    if (nameEdited.current || !patient.data) return;
    const name = patient.data.name?.[0];
    if (firstName === '' && name?.given?.join(' ')) setFirstName(name.given.join(' '));
    if (lastName === '' && name?.family) setLastName(name.family);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.data]);

  const submit = async () => {
    setSubmitError(null);

    try {
      const existing = patient.data;
      let patientRef: string;
      if (existing?.id) {
        if (firstName.trim() || lastName.trim()) {
          await updatePatient.mutateAsync({ id: existing.id, given: firstName, family: lastName });
        }
        patientRef = `Patient/${existing.id}`;
      } else {
        const created = await ensurePatient.mutateAsync({ given: firstName, family: lastName });
        patientRef = `Patient/${created.id}`;
      }

      await consent.mutateAsync(patientRef);
      await requestReminderPermissionsAtConsent();
      await AsyncStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
      const tourSeen = await AsyncStorage.getItem(TOUR_SEEN_STORAGE_KEY);
      router.replace(tourSeen ? '/(tabs)/today' : '/tour');
    } catch {
      setSubmitError(t('consentSaveError'));
    }
  };

  const busy = consent.isPending || ensurePatient.isPending || updatePatient.isPending || patient.isLoading;

  const trustPoints: { icon: IconName; tone: ToneName; title: string; description: string }[] = [
    {
      icon: 'lock-closed-outline',
      tone: 'apricot',
      title: t('consentPillarStandardTitle'),
      description: t('consentPillarStandardDescription'),
    },
    {
      icon: 'notifications-outline',
      tone: 'sky',
      title: t('consentPillarRemindersTitle'),
      description: t('consentPillarRemindersDescription'),
    },
    {
      icon: 'document-text-outline',
      tone: 'butter',
      title: t('consentPillarReportTitle'),
      description: t('consentPillarReportDescription'),
    },
  ];

  return (
    <PageShell>
      <View style={styles.page}>
        <Animated.View entering={reduce ? undefined : FadeInDown.duration(420)} style={styles.lead}>
          <TaktMark size={44} />
          <Text style={[typography.overline, styles.eyebrow, { color: c.textSecondary }]}>{t('consentTitle')}</Text>
          <Text accessibilityRole="header" style={[typography.title1, { color: c.textPrimary }]}>
            {t('consentHeadline')}
          </Text>
          <Text style={[typography.body, { color: c.textSecondary }]}>{t('consentBody')}</Text>
        </Animated.View>

        <Card>
          {trustPoints.map((point, index) => (
            <Animated.View
              key={point.icon}
              entering={enter(index + 2)}
              style={[styles.point, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}
            >
              <View style={[styles.pointIcon, { backgroundColor: c.tones[point.tone].bg }]}>
                <Ionicons name={point.icon} size={18} color={INK} />
              </View>
              <View style={[styles.flex, { gap: 2 }]}>
                <Text style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>{point.title}</Text>
                <Text style={[typography.subhead, { color: c.textSecondary }]}>{point.description}</Text>
              </View>
            </Animated.View>
          ))}
        </Card>

        <Animated.View entering={enter(5)}>
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(2.5) }}>
              <Text style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>
                {t('onboardingYourNameTitle')}
              </Text>
              <Text style={[typography.subhead, { color: c.textSecondary }]}>
                {t('onboardingYourNameSubtitle')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing(2.5), marginTop: spacing(1) }}>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder={t('firstNamePlaceholder')}
                    value={firstName}
                    onChangeText={(value) => {
                      nameEdited.current = true;
                      setFirstName(value);
                    }}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder={t('lastNamePlaceholder')}
                    value={lastName}
                    onChangeText={(value) => {
                      nameEdited.current = true;
                      setLastName(value);
                    }}
                    autoCapitalize="words"
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={enter(6)} style={styles.note}>
          <Ionicons name="information-circle-outline" size={20} color={c.textSecondary} />
          <View style={[styles.flex, { gap: spacing(1.5) }]}>
            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('safetyNote')}</Text>
            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('consentPermissionsHint')}</Text>
          </View>
        </Animated.View>

        {submitError ? (
          <Animated.View entering={FadeIn.duration(220)} accessibilityRole="alert" style={[styles.error, { backgroundColor: c.tones.rose.bg }]}>
            <Ionicons name="alert-circle" size={20} color={c.tones.rose.fg} />
            <Text style={[typography.subhead, styles.flex, { color: INK }]}>{submitError}</Text>
          </Animated.View>
        ) : null}

        <Animated.View entering={reduce ? undefined : FadeInDown.delay(stagger(6)).duration(360)} style={styles.actions}>
          <Button size="lg" accentIcon="arrow-forward" label={t('acceptConsent')} onPress={() => void submit()} loading={busy} />
          <Button kind="ghost" label={t('privacyNotice')} onPress={() => router.push('/settings/privacy')} />
        </Animated.View>
      </View>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing(5) },
  lead: { gap: spacing(2) },
  eyebrow: { marginTop: spacing(2) },
  point: { paddingHorizontal: spacing(4), paddingVertical: spacing(3.5), flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start' },
  pointIcon: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  note: { flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start', paddingHorizontal: spacing(1) },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), padding: spacing(3.5), borderRadius: radius.md },
  actions: { gap: spacing(1) },
});
