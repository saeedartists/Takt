import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import {
  AnimatedPressable,
  AnimatedSegmentedControl,
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  INK,
  Input,
  ListGroup,
  ListRow,
  PageHeader,
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
} from '@/components/ui';
import {
  useFamilySharingGrants,
  useGrantFamilySharing,
  useRevokeFamilySharing,
} from '@/lib/hooks/use-family-sharing-grants';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';

/*
 * Patient side of family sharing (brief §11). Inviting a relative is a
 * separate Article 9 disclosure: its own affirmative consent, its own
 * Consent resource, revocable in one step with the revocation recorded.
 */

const RELATIONSHIP_OPTIONS = [
  { value: 'FAMMEMB', labelKey: 'familySharingRelationshipFamily' as const },
  { value: 'SPS', labelKey: 'familySharingRelationshipSpouse' as const },
  { value: 'CGV', labelKey: 'familySharingRelationshipCaregiver' as const },
] as const;

const normalize = (value: string): string => value.trim().toLowerCase();
const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function FamilySharingScreen() {
  const { t, formatDateTime } = useLocale();
  const { c } = useTokens();
  const { enter, stagger, duration, reduce } = useMotion();
  const router = useRouter();

  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const grants = useFamilySharingGrants(patientRef);
  const grantMutation = useGrantFamilySharing();
  const revokeMutation = useRevokeFamilySharing();

  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [email, setEmail] = useState('');
  const [relationshipCode, setRelationshipCode] =
    useState<(typeof RELATIONSHIP_OPTIONS)[number]['value']>('FAMMEMB');
  const [consented, setConsented] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingRevokeGrantId, setPendingRevokeGrantId] = useState<string | null>(null);

  const grantedByRef = useMemo(() => ({ reference: patientRef ?? 'Patient/unknown' }), [patientRef]);

  const hasDuplicate = useMemo(() => {
    const mail = normalize(email);
    if (!mail) return false;
    return grants.grants.some((grant) => grant.status === 'granted' && grant.email === mail);
  }, [email, grants.grants]);

  const relativeName = `${givenName.trim()} ${familyName.trim()}`.trim() || t('familySharingRelationshipFamily');
  const consentText = t('familySharingConsentCheckbox').replace('{name}', relativeName);
  const canSubmit =
    Boolean(givenName.trim()) && Boolean(familyName.trim()) && isEmail(email) && consented && !hasDuplicate;

  const submitGrant = async () => {
    setSubmitError(null);
    setSuccessMessage(null);

    if (!patientRef) return setSubmitError(t('familySharingNeedsPatient'));
    if (!givenName.trim() || !familyName.trim()) return setSubmitError(t('familySharingNameRequired'));
    if (!isEmail(email)) return setSubmitError(t('familySharingEmailRequired'));
    if (!consented) return setSubmitError(t('familySharingConsentRequired'));
    if (hasDuplicate) return setSubmitError(t('familySharingDuplicateError'));

    try {
      await grantMutation.mutateAsync({
        patientRef,
        givenName,
        familyName,
        relationshipCode,
        email,
        grantedByRef,
      });
      setSuccessMessage(t('familySharingGrantSuccess'));
      setGivenName('');
      setFamilyName('');
      setEmail('');
      setRelationshipCode('FAMMEMB');
      setConsented(false);
    } catch {
      setSubmitError(t('familySharingGrantError'));
    }
  };

  const revokeGrant = async (grant: (typeof grants.grants)[number]) => {
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await revokeMutation.mutateAsync({ grant, revokedByRef: grantedByRef });
      setPendingRevokeGrantId(null);
      setSuccessMessage(t('familySharingRevokeSuccess'));
    } catch {
      setSubmitError(t('familySharingRevokeError'));
    }
  };

  const relationLabel = (code?: string) =>
    code === 'SPS'
      ? t('familySharingRelationshipSpouse')
      : code === 'CGV'
        ? t('familySharingRelationshipCaregiver')
        : t('familySharingRelationshipFamily');

  if (patient.isLoading || grants.isLoading) {
    return (
      <PageShell>
        <PageHeader subtitle={t('familySharingSubtitle')} />
        <SkeletonCard rows={3} />
      </PageShell>
    );
  }

  if (patient.error || grants.error) {
    return (
      <PageShell>
        <ErrorState
          description={t('familySharingLoadError')}
          onRetry={() => {
            void patient.refetch();
            void grants.refetch();
          }}
        />
      </PageShell>
    );
  }

  const activeGrants = grants.grants.filter((grant) => grant.status === 'granted');
  const revokedGrants = grants.grants.filter((grant) => grant.status === 'revoked');
  const ownName = patient.data?.name?.[0];
  const ownInitial = (ownName?.given?.[0]?.[0] ?? ownName?.family?.[0] ?? '·').toUpperCase();

  return (
    <PageShell>
      <Stack>
        {/* Hero: sage = family. You, the people who can see, and an open seat. */}
        <Animated.View entering={enter(0)}>
          <Tile tone="sage" style={styles.hero}>
            <View style={styles.cluster} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Avatar letter={ownInitial} bg={c.tones.lilac.bg} ring={c.tones.sage.bg} index={0} />
              {activeGrants.slice(0, 2).map((grant, index) => (
                <Avatar
                  key={grant.id}
                  letter={grant.relatedPersonLabel.trim()[0]?.toUpperCase() ?? '·'}
                  bg={c.tones.apricot.bg}
                  ring={c.tones.sage.bg}
                  index={index + 1}
                />
              ))}
              <Animated.View
                entering={FadeIn.delay(stagger(activeGrants.slice(0, 2).length + 1) + 120)}
                style={[styles.avatar, styles.avatarOverlap, styles.avatarOpen, { borderColor: c.tones.sage.fg }]}
              >
                <Ionicons name="add" size={20} color={c.tones.sage.fg} />
              </Animated.View>
            </View>
            <View style={styles.heroText}>
              <Text accessibilityRole="header" style={[typography.title2, { color: INK }]}>
                {t('familySharingHeroTitle')}
              </Text>
              <Text style={[typography.subhead, { color: c.tones.sage.fg }]}>{t('familySharingSubtitle')}</Text>
            </View>
          </Tile>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <SectionHeader title={t('familySharingScopeTitle')} />
          <Card>
            <View style={styles.scope}>
              {[t('familySharingAllowedLine1'), t('familySharingAllowedLine2')].map((line) => (
                <ScopeLine key={line} allowed label={line} />
              ))}
              <View style={[styles.divider, { backgroundColor: c.separator }]} />
              {[t('familySharingBlockedLine1'), t('familySharingBlockedLine2'), t('familySharingBlockedLine3')].map((line) => (
                <ScopeLine key={line} label={line} />
              ))}
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <SectionHeader title={t('familySharingActiveListTitle').replace('{count}', activeGrants.length.toString())} />
          {activeGrants.length === 0 ? (
            <Card>
              <View style={styles.emptyRow}>
                <View style={[styles.scopeIcon, styles.emptyIcon, { backgroundColor: c.surfaceRaised }]}>
                  <Ionicons name="people-outline" size={20} color={c.textPrimary} />
                </View>
                <View style={styles.flex}>
                  <Text style={[typography.headline, { color: c.textPrimary }]}>{t('familySharingNoGrants')}</Text>
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('familySharingNoGrantsHint')}</Text>
                </View>
              </View>
            </Card>
          ) : (
            <View style={styles.list}>
              {activeGrants.map((grant) => {
                const accepted = Boolean(grant.linkedAccountRef);
                const revokeConfirm = pendingRevokeGrantId === grant.id;
                const subtitle = accepted
                  ? t('familySharingActiveSince').replace('{date}', formatDateTime(new Date(grant.acceptedAt ?? grant.grantedAt)))
                  : t('familySharingInvitedWaiting').replace('{email}', grant.email ?? '');

                return (
                  <Animated.View key={grant.id} entering={FadeInDown.duration(duration.base)} layout={LinearTransition.duration(duration.base)}>
                    <Card>
                      <View style={styles.grantBody}>
                        <View style={styles.grantHead}>
                          <View style={[styles.avatar, { backgroundColor: c.tones.apricot.bg }]}>
                            <Text style={[typography.title3, { color: INK }]}>
                              {grant.relatedPersonLabel.trim()[0]?.toUpperCase() ?? '·'}
                            </Text>
                          </View>
                          <View style={styles.flex}>
                            <Text style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>
                              {`${grant.relatedPersonLabel} · ${relationLabel(grant.relationshipCode)}`}
                            </Text>
                            <Text style={[typography.subhead, { color: c.textSecondary }]}>{subtitle}</Text>
                            <View style={styles.grantBadge}>
                              <Badge
                                size="sm"
                                label={accepted ? t('statusActive') : t('familySharingStatusInvited')}
                                tone={accepted ? 'success' : 'warning'}
                                icon={accepted ? 'checkmark-circle' : 'time-outline'}
                              />
                            </View>
                          </View>
                        </View>
                        <View style={styles.grantActions}>
                          <View>
                            <Button
                              kind="secondary"
                              size="sm"
                              label={t('familySharingPreviewCta')}
                              icon={<Ionicons name="eye-outline" size={18} color={c.textPrimary} />}
                              onPress={() =>
                                router.push({
                                  pathname: '/settings/relative-view',
                                  params: { relatedPersonRef: grant.relatedPersonRef },
                                } as never)
                              }
                            />
                          </View>
                          <View>
                            <Button
                              kind={revokeConfirm ? 'destructive' : 'outline'}
                              size="sm"
                              label={revokeConfirm ? t('familySharingRevokeConfirmCta') : t('familySharingRevokeCta')}
                              loading={revokeMutation.isPending && revokeConfirm}
                              disabled={revokeMutation.isPending || grantMutation.isPending}
                              onPress={() => (revokeConfirm ? void revokeGrant(grant) : setPendingRevokeGrantId(grant.id))}
                            />
                          </View>
                        </View>
                        {revokeConfirm ? (
                          <Animated.Text entering={FadeIn.duration(duration.base)} style={[typography.footnote, { color: c.textSecondary }]}>
                            {t('familySharingRevokeConfirmHint')}
                          </Animated.Text>
                        ) : null}
                      </View>
                    </Card>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={enter(3)} layout={LinearTransition.duration(duration.base)}>
          <SectionHeader title={t('familySharingAddTitle')} />
          <Card>
            <View style={styles.form}>
              <Field label={t('familySharingFirstNameLabel')}>
                <Input value={givenName} onChangeText={setGivenName} placeholder={t('familySharingFirstNamePlaceholder')} autoCapitalize="words" />
              </Field>
              <Field label={t('familySharingLastNameLabel')}>
                <Input value={familyName} onChangeText={setFamilyName} placeholder={t('familySharingLastNamePlaceholder')} autoCapitalize="words" />
              </Field>
              <Field
                label={t('familySharingEmailLabel')}
                error={email.trim() && !isEmail(email) ? t('familySharingEmailRequired') : hasDuplicate ? t('familySharingDuplicateHint') : undefined}
              >
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('familySharingEmailOptionalPlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  invalid={Boolean(email.trim()) && !isEmail(email)}
                />
              </Field>
              <Field label={t('familySharingRelationshipLabel')}>
                <AnimatedSegmentedControl
                  value={relationshipCode}
                  onChange={(next) => setRelationshipCode(next as (typeof RELATIONSHIP_OPTIONS)[number]['value'])}
                  options={RELATIONSHIP_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                />
              </Field>

              {/* Unbundled, affirmative Article 9 consent for this one relative. */}
              <AnimatedPressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consented }}
                accessibilityLabel={consentText}
                haptic="light"
                scaleTo={0.98}
                onPress={() => setConsented((value) => !value)}
                style={[styles.consentRow, { backgroundColor: c.surfaceSubtle, borderColor: consented ? c.textPrimary : c.separator }]}
              >
                <View style={[styles.box, { borderColor: c.textPrimary, backgroundColor: consented ? c.ink : 'transparent' }]}>
                  {consented ? (
                    <Animated.View entering={reduce ? undefined : ZoomIn.duration(180)}>
                      <Ionicons name="checkmark" size={18} color={c.onInk} />
                    </Animated.View>
                  ) : null}
                </View>
                <Text style={[typography.subhead, styles.flex, { color: c.textPrimary }]}>{consentText}</Text>
              </AnimatedPressable>

              {submitError ? (
                <Animated.View entering={FadeIn.duration(duration.base)} accessibilityRole="alert" style={styles.message}>
                  <Ionicons name="alert-circle" size={18} color={c.destructive} />
                  <Text style={[typography.subhead, styles.flex, { color: c.destructive }]}>{submitError}</Text>
                </Animated.View>
              ) : null}
              {successMessage ? (
                <Animated.View entering={FadeIn.duration(duration.base)} style={styles.message}>
                  <Ionicons name="checkmark-circle" size={18} color={c.success} />
                  <Text style={[typography.subhead, styles.flex, { color: c.textPrimary }]}>{successMessage}</Text>
                </Animated.View>
              ) : null}

              <Button
                size="lg"
                label={t('familySharingGrantCta')}
                icon={<Ionicons name="mail-outline" size={20} color={canSubmit ? c.onInk : c.textTertiary} />}
                loading={grantMutation.isPending}
                disabled={!canSubmit || revokeMutation.isPending}
                onPress={() => void submitGrant()}
              />
            </View>
          </Card>
        </Animated.View>

        {revokedGrants.length > 0 ? (
          <Animated.View entering={enter(4)}>
            <SectionHeader title={t('familySharingRevokedListTitle')} />
            <ListGroup>
              {revokedGrants.map((grant, index) => (
                <ListRow
                  key={grant.id}
                  isFirst={index === 0}
                  title={grant.relatedPersonLabel}
                  subtitle={
                    grant.revokedAt
                      ? `${t('familySharingRevokedAt')}: ${formatDateTime(new Date(grant.revokedAt))}`
                      : t('statusArchived')
                  }
                  trailing={<Badge label={t('familySharingRevokedAt')} tone="neutral" icon="close-circle-outline" />}
                />
              ))}
            </ListGroup>
          </Animated.View>
        ) : null}
      </Stack>
    </PageShell>
  );
}

/** A cluster avatar that pops in after the one before it. */
function Avatar({ letter, bg, ring, index }: { letter: string; bg: string; ring: string; index: number }) {
  const { stagger, reduce } = useMotion();
  return (
    <Animated.View
      entering={reduce ? undefined : ZoomIn.delay(stagger(index) + 120).duration(260)}
      style={[styles.avatar, styles.avatarLg, index > 0 && styles.avatarOverlap, { backgroundColor: bg, borderColor: ring }]}
    >
      <Text style={[typography.title3, { color: INK }]}>{letter}</Text>
    </Animated.View>
  );
}

/** Allowed / not allowed line: icon + words, so the meaning never rests on colour. */
function ScopeLine({ label, allowed = false }: { label: string; allowed?: boolean }) {
  const { c } = useTokens();
  return (
    <View style={styles.scopeLine}>
      <View style={[styles.scopeIcon, { backgroundColor: allowed ? c.tones.sage.bg : c.surfaceRaised }]}>
        <Ionicons name={allowed ? 'checkmark' : 'close'} size={16} color={allowed ? c.tones.sage.fg : c.textSecondary} />
      </View>
      <Text style={[typography.callout, styles.flex, { color: allowed ? c.textPrimary : c.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  hero: { gap: spacing(3), padding: spacing(4.5), borderRadius: radius.xxl },
  heroText: { gap: spacing(1) },
  cluster: { flexDirection: 'row' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLg: { width: 48, height: 48, borderRadius: 24, borderWidth: 3 },
  avatarOverlap: { marginLeft: -12 },
  avatarOpen: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  scope: { padding: spacing(4), gap: spacing(2.5) },
  scopeLine: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  scopeIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing(1) },
  list: { gap: spacing(3) },
  grantBody: { padding: spacing(4), gap: spacing(3) },
  emptyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(3), padding: spacing(4) },
  emptyIcon: { width: 40, height: 40, borderRadius: 20 },
  grantHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(3) },
  grantBadge: { marginTop: spacing(1.5) },
  grantActions: { gap: spacing(2) },
  form: { padding: spacing(4), gap: spacing(4) },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(3),
    padding: spacing(3.5),
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
});
