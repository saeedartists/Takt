import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { INK, Tile, font, spacing, typography, useMotion, useTokens, type IconName } from '@/components/ui';
import { appointmentDate, daysUntil, splitAppointments, useCare, type CareAppointment, type CareRole } from '@/lib/takt/care';
import { useLocale } from '@/lib/takt/l10n';

type Locale = ReturnType<typeof useLocale>;
type MessageKey = Parameters<Locale['t']>[0];

/** Role → icon, label and tone (sky = medical visits, butter = pharmacy/supply, sage = family). */
export const CARE_ROLE_META: Record<CareRole, { icon: IconName; label: MessageKey; tone: 'sky' | 'butter' | 'sage' | 'lilac' }> = {
  doctor: { icon: 'medkit-outline', label: 'careRoleDoctor', tone: 'sky' },
  specialist: { icon: 'pulse-outline', label: 'careRoleSpecialist', tone: 'sky' },
  pharmacy: { icon: 'storefront-outline', label: 'careRolePharmacy', tone: 'butter' },
  nurse: { icon: 'heart-outline', label: 'careRoleNurse', tone: 'sage' },
  family: { icon: 'people-outline', label: 'careRoleFamily', tone: 'sage' },
  other: { icon: 'person-outline', label: 'careRoleOther', tone: 'lilac' },
};

/** "Thu 2 Oct, 10:30" (weekday + day + month, plus the time when set). */
export const formatVisitWhen = (a: CareAppointment, { formatDate, formatTime }: Pick<Locale, 'formatDate' | 'formatTime'>): string => {
  const d = appointmentDate(a);
  const day = formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
  return a.time ? `${day}, ${formatTime(d)}` : day;
};

/** "Today" / "Tomorrow" / "in 3 days". */
export const relativeDays = (days: number, t: Locale['t']): string =>
  days <= 0 ? t('careToday') : days === 1 ? t('careTomorrow') : t('careInDays').replace('{count}', String(days));

/*
 * NextVisitCard — one calm sky line on Today for the next appointment
 * within two weeks: "Dr. Weber · Thu 2 Oct, 10:30 · in 3 days".
 * Tap opens the care team. Renders nothing when there is none.
 */
export function NextVisitCard() {
  const router = useRouter();
  const { c } = useTokens();
  const locale = useLocale();
  const { enter } = useMotion();
  const care = useCare();

  const next = splitAppointments(care.appointments).upcoming[0];
  if (!next) return null;
  const days = daysUntil(next);
  if (days > 14) return null;

  const contact = care.contacts.find((x) => x.id === next.contactId);
  const sky = c.tones.sky;
  const when = formatVisitWhen(next, locale);
  const soon = relativeDays(days, locale.t);
  const who = contact?.name ?? next.title;

  return (
    <Animated.View entering={enter(0)}>
      <Tile
        tone="sky"
        onPress={() => router.push('/care' as never)}
        accessibilityLabel={`${locale.t('careNextVisit')}: ${who}, ${when}, ${soon}`}
        style={styles.tile}
      >
        <View style={styles.icon}>
          <Ionicons name="calendar-outline" size={20} color={INK} />
        </View>
        <View style={styles.text}>
          <Text numberOfLines={1} style={[typography.caption, { color: sky.fg, fontFamily: font.bold }]}>
            {locale.t('careNextVisit')} · {soon}
          </Text>
          <Text numberOfLines={1} style={[typography.headline, { color: INK, fontVariant: ['tabular-nums'] }]}>
            {who} · {when}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={sky.fg} />
      </Tile>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(3), paddingHorizontal: spacing(3.5) },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: 1 },
});
