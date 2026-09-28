import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import {
  AnimatedNumber,
  AnimatedPressable,
  Button,
  Card,
  INK,
  ListGroup,
  PageShell,
  SectionHeader,
  SkeletonCard,
  Stack,
  Tile,
  font,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
  type IconName,
} from '@/components/ui';
import { CARE_ROLE_META, formatVisitWhen } from '@/components/takt/next-visit-card';
import { appointmentDate, daysUntil, splitAppointments, useCare, type CareAppointment, type CareContact } from '@/lib/takt/care';
import { useLocale } from '@/lib/takt/l10n';

/** White-glass round button for use on a pastel tile (tiles stay light in dark mode). */
function GlassButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={label} haptic="light" scaleTo={0.9} onPress={onPress} style={styles.glass}>
      <Ionicons name={icon} size={22} color={INK} />
    </AnimatedPressable>
  );
}

/** Small "+ Add" pill beside a section title. */
function AddAction({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const { c } = useTokens();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      haptic="light"
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      style={[styles.addPill, { backgroundColor: c.surfaceRaised }]}
    >
      <Ionicons name="add" size={18} color={c.textPrimary} />
      <Text style={[typography.subhead, { color: c.textPrimary, fontFamily: font.semibold }]}>{label}</Text>
    </AnimatedPressable>
  );
}

/** Compact explanation card: what to add here and why. */
function EmptyHint({ icon, title, body, action }: { icon: IconName; title: string; body: string; action: ReactNode }) {
  const { c } = useTokens();
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyRow}>
        <View style={[styles.roleIcon, { backgroundColor: c.surfaceRaised }]}>
          <Ionicons name={icon} size={20} color={c.textPrimary} />
        </View>
        <View style={styles.flex}>
          <Text style={[typography.headline, { color: c.textPrimary }]}>{title}</Text>
          <Text style={[typography.footnote, { color: c.textSecondary }]}>{body}</Text>
        </View>
      </View>
      {action}
    </Card>
  );
}

/** Sky hero: the next visit, a days-to-go count and one action (prepare the doctor report). */
function NextVisitHero({ appt, contact }: { appt: CareAppointment; contact?: CareContact }) {
  const router = useRouter();
  const { c } = useTokens();
  const locale = useLocale();
  const { t } = locale;
  const sky = c.tones.sky;
  const days = daysUntil(appt);
  const when = formatVisitWhen(appt, locale);
  const lines: { icon: IconName; text: string }[] = [
    { icon: 'calendar-outline', text: when },
    ...(contact ? [{ icon: CARE_ROLE_META[contact.role].icon, text: contact.name }] : []),
    ...(appt.place ? [{ icon: 'location-outline' as IconName, text: appt.place }] : []),
  ];
  const edit = () => router.push({ pathname: '/care/appointment', params: { id: appt.id } } as never);

  return (
    <Tile tone="sky" style={styles.hero}>
      <View style={styles.heroTop}>
        <Text style={[typography.overline, { color: sky.fg, flex: 1 }]}>{t('careNextVisit')}</Text>
        <GlassButton icon="add" label={t('careAddAppointment')} onPress={() => router.push('/care/appointment' as never)} />
      </View>

      <View style={styles.heroBody}>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={`${appt.title}, ${lines.map((l) => l.text).join(', ')}`}
          accessibilityHint={t('careAppointmentRouteTitle')}
          scaleTo={0.98}
          onPress={edit}
          style={styles.flex}
        >
          <Text numberOfLines={2} style={[typography.title2, { color: INK }]}>
            {appt.title}
          </Text>
          <View style={styles.heroLines}>
            {lines.map((line) => (
              <View key={line.icon + line.text} style={styles.heroLine}>
                <Ionicons name={line.icon} size={16} color={sky.fg} />
                <Text numberOfLines={1} style={[typography.subhead, styles.flex, { color: sky.fg, fontVariant: ['tabular-nums'] }]}>
                  {line.text}
                </Text>
              </View>
            ))}
          </View>
        </AnimatedPressable>

        {/* Days to go: a count, never a colour. */}
        <View style={styles.count} accessible accessibilityLabel={days === 0 ? t('careToday') : `${days} ${days === 1 ? t('careDayLeft') : t('careDaysLeft')}`}>
          {days === 0 ? (
            <Text style={[typography.title3, { color: INK }]}>{t('careToday')}</Text>
          ) : (
            <>
              <AnimatedNumber value={days} style={[typography.metricSm, { color: INK, fontVariant: ['tabular-nums'] }]} />
              <Text numberOfLines={2} style={[typography.caption, styles.countLabel, { color: sky.fg }]}>
                {days === 1 ? t('careDayLeft') : t('careDaysLeft')}
              </Text>
            </>
          )}
        </View>
      </View>

      <Button label={t('carePrepare')} accentIcon="document-text-outline" size="md" onTone onPress={() => router.push('/report')} />
    </Tile>
  );
}

function ContactRow({ contact, isFirst }: { contact: CareContact; isFirst: boolean }) {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();
  const meta = CARE_ROLE_META[contact.role];
  const tone = c.tones[meta.tone];
  const subtitle = [t(meta.label), contact.note].filter(Boolean).join(' · ');

  return (
    <View style={[styles.row, !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`${contact.name}, ${subtitle}`}
        scaleTo={0.98}
        onPress={() => router.push({ pathname: '/care/contact', params: { id: contact.id } } as never)}
        style={styles.rowMain}
      >
        <View style={[styles.roleIcon, { backgroundColor: tone.bg }]}>
          <Ionicons name={meta.icon} size={20} color={INK} />
        </View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[typography.headline, { color: c.textPrimary }]}>
            {contact.name}
          </Text>
          <Text numberOfLines={1} style={[typography.footnote, { color: c.textSecondary }]}>
            {subtitle}
          </Text>
        </View>
      </AnimatedPressable>
      <View style={styles.rowActions}>
        {contact.phone ? (
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={t('careCall').replace('{name}', contact.name)}
            haptic="light"
            scaleTo={0.9}
            onPress={() => void Linking.openURL(`tel:${contact.phone!.replace(/[^\d+]/g, '')}`)}
            style={[styles.round, { backgroundColor: c.ink }]}
          >
            <Ionicons name="call" size={19} color={c.onInk} />
          </AnimatedPressable>
        ) : null}
        {contact.email ? (
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={t('careEmail').replace('{name}', contact.name)}
            haptic="light"
            scaleTo={0.9}
            onPress={() => void Linking.openURL(`mailto:${contact.email}`)}
            style={[styles.round, { backgroundColor: c.surfaceRaised }]}
          >
            <Ionicons name="mail-outline" size={19} color={c.textPrimary} />
          </AnimatedPressable>
        ) : null}
      </View>
    </View>
  );
}

/** Date block + title + "10:30 · Dr. Weber · Room 2". Past visits sit quieter. */
function AppointmentRow({ appt, contact, past, isFirst }: { appt: CareAppointment; contact?: CareContact; past: boolean; isFirst: boolean }) {
  const router = useRouter();
  const { c } = useTokens();
  const { formatDate, formatTime } = useLocale();
  const d = appointmentDate(appt);
  const detail = [appt.time ? formatTime(d) : null, contact?.name, appt.place].filter(Boolean).join(' · ');
  const month = formatDate(d, { month: 'short' }).replace('.', '');

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${appt.title}, ${formatDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${detail ? `, ${detail}` : ''}`}
      scaleTo={0.98}
      onPress={() => router.push({ pathname: '/care/appointment', params: { id: appt.id } } as never)}
      style={[styles.row, styles.rowPad, !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}
    >
      <View style={[styles.dateBlock, { backgroundColor: past ? c.surfaceRaised : c.tones.sky.bg }]}>
        <Text style={[typography.caption2, { color: past ? c.textSecondary : c.tones.sky.fg, textTransform: 'uppercase' }]}>{month}</Text>
        <Text style={[typography.title3, { color: past ? c.textPrimary : INK, fontVariant: ['tabular-nums'] }]}>{d.getDate()}</Text>
      </View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={[typography.headline, { color: past ? c.textSecondary : c.textPrimary }]}>
          {appt.title}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={[typography.footnote, { color: c.textTertiary, fontVariant: ['tabular-nums'] }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
    </AnimatedPressable>
  );
}

/*
 * Care team — the next visit (sky = visits), the people who look after
 * you with one-tap call / email, then upcoming and past appointments.
 * Everything stays on this device.
 */
export default function CareScreen() {
  const router = useRouter();
  const { c } = useTokens();
  const { t } = useLocale();
  const { enter, reduce } = useMotion();
  const care = useCare();
  const { upcoming, past } = splitAppointments(care.appointments);
  const [next, ...later] = upcoming;
  const contactFor = (a: CareAppointment) => care.contacts.find((x) => x.id === a.contactId);
  const layout = reduce ? undefined : LinearTransition.duration(220);
  const addContact = () => router.push('/care/contact' as never);
  const addAppointment = () => router.push('/care/appointment' as never);

  return (
    <PageShell>
      {care.isLoading ? (
        <Stack>
          <SkeletonCard />
          <SkeletonCard />
        </Stack>
      ) : (
        <Stack>
          <Animated.View entering={enter(0)} layout={layout}>
            {next ? (
              <NextVisitHero appt={next} contact={contactFor(next)} />
            ) : (
              <Tile tone="sky" style={styles.hero}>
                <Text style={[typography.overline, { color: c.tones.sky.fg }]}>{t('careNextVisit')}</Text>
                <View style={styles.gap1}>
                  <Text style={[typography.title3, { color: INK }]}>{t('careAppointmentsEmptyTitle')}</Text>
                  <Text style={[typography.subhead, { color: INK }]}>{t('careAppointmentsEmptyBody')}</Text>
                </View>
                <Button label={t('careAddAppointment')} accentIcon="add" size="md" onTone onPress={addAppointment} />
              </Tile>
            )}
          </Animated.View>

          <Animated.View entering={enter(1)} layout={layout}>
            <SectionHeader
              title={t('careTeamSection')}
              action={care.contacts.length ? <AddAction label={t('careAdd')} a11y={t('careAddContact')} onPress={addContact} /> : undefined}
            />
            {care.contacts.length ? (
              <ListGroup>
                {care.contacts.map((contact, i) => (
                  <ContactRow key={contact.id} contact={contact} isFirst={i === 0} />
                ))}
              </ListGroup>
            ) : (
              <EmptyHint
                icon="people-outline"
                title={t('careContactsEmptyTitle')}
                body={t('careContactsEmptyBody')}
                action={
                  <Button kind="secondary" size="sm" fullWidth={false} label={t('careAddContact')} icon={<AddIcon />} onPress={addContact} />
                }
              />
            )}
          </Animated.View>

          {later.length ? (
            <Animated.View entering={enter(2)} layout={layout}>
              <SectionHeader title={t('careUpcoming')} />
              <ListGroup>
                {later.map((a, i) => (
                  <AppointmentRow key={a.id} appt={a} contact={contactFor(a)} past={false} isFirst={i === 0} />
                ))}
              </ListGroup>
            </Animated.View>
          ) : null}

          {past.length ? (
            <Animated.View entering={enter(3)} layout={layout}>
              <SectionHeader title={t('carePast')} />
              <ListGroup>
                {past.map((a, i) => (
                  <AppointmentRow key={a.id} appt={a} contact={contactFor(a)} past isFirst={i === 0} />
                ))}
              </ListGroup>
            </Animated.View>
          ) : null}
        </Stack>
      )}
    </PageShell>
  );
}

function AddIcon() {
  const { c } = useTokens();
  return <Ionicons name="add" size={18} color={c.textPrimary} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap1: { gap: spacing(1) },
  hero: { borderRadius: radius.xxl, padding: spacing(4.5), gap: spacing(3) },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: -spacing(1), marginRight: -spacing(1) },
  heroBody: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(3) },
  heroLines: { gap: spacing(1), marginTop: spacing(1.5) },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  count: {
    minWidth: 76,
    maxWidth: 96,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2),
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
  },
  countLabel: { textAlign: 'center' },
  glass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    minHeight: 36,
    paddingLeft: spacing(2.5),
    paddingRight: spacing(3.5),
    borderRadius: radius.full,
  },
  empty: { padding: spacing(4), gap: spacing(3) },
  emptyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  rowPad: { minHeight: 64, paddingHorizontal: spacing(4), paddingVertical: spacing(2.5) },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing(3), minHeight: 64, paddingLeft: spacing(4), paddingVertical: spacing(2.5) },
  rowActions: { flexDirection: 'row', gap: spacing(2), paddingRight: spacing(3) },
  roleIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dateBlock: { width: 46, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
