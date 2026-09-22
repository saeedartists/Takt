import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedPressable,
  AnimatedSegmentedControl,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  ListGroup,
  ListRow,
  PageHeader,
  PageShell,
  SectionHeader,
  SkeletonCard,
  Stack,
  radius,
  spacing,
  typography,
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

  return (
    <PageShell>
      <PageHeader subtitle={t('familySharingSubtitle')} />

      <Stack>
        <View>
          <SectionHeader title={t('familySharingAddTitle')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
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
                onPress={() => setConsented((value) => !value)}
                style={[
                  styles.consentRow,
                  { borderColor: consented ? c.accent : c.separator, backgroundColor: consented ? `${c.accent}0F` : c.surface },
                ]}
              >
                <Ionicons name={consented ? 'checkbox' : 'square-outline'} size={24} color={consented ? c.accent : c.textTertiary} />
                <Text style={[typography.subhead, { color: c.textPrimary, flex: 1, minWidth: 0 }]}>{consentText}</Text>
              </AnimatedPressable>

              {submitError ? (
                <Text accessibilityRole="alert" style={[typography.footnote, { color: c.destructive }]}>{submitError}</Text>
              ) : null}
              {successMessage ? <Text style={[typography.footnote, { color: c.success }]}>{successMessage}</Text> : null}

              <Button
                label={t('familySharingGrantCta')}
                icon={<Ionicons name="mail-outline" size={18} color={c.surface} />}
                loading={grantMutation.isPending}
                disabled={!canSubmit || revokeMutation.isPending}
                onPress={() => void submitGrant()}
              />
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title={t('familySharingActiveListTitle').replace('{count}', activeGrants.length.toString())} />
          {activeGrants.length === 0 ? (
            <EmptyState title={t('familySharingNoGrants')} description={t('familySharingNoGrantsHint')} />
          ) : (
            <Stack>
              {activeGrants.map((grant) => {
                const accepted = Boolean(grant.linkedAccountRef);
                const revokeConfirm = pendingRevokeGrantId === grant.id;
                const subtitle = accepted
                  ? t('familySharingActiveSince').replace('{date}', formatDateTime(new Date(grant.acceptedAt ?? grant.grantedAt)))
                  : t('familySharingInvitedWaiting').replace('{email}', grant.email ?? '');

                return (
                  <Card key={grant.id}>
                    <ListRow
                      isFirst
                      title={`${grant.relatedPersonLabel} · ${relationLabel(grant.relationshipCode)}`}
                      subtitle={subtitle}
                      trailing={
                        <Badge label={accepted ? t('statusActive') : t('familySharingStatusInvited')} tone={accepted ? 'success' : 'neutral'} />
                      }
                    />
                    <View style={styles.grantActions}>
                      <Button
                        kind="secondary"
                        size="sm"
                        label={t('familySharingPreviewCta')}
                        onPress={() =>
                          router.push({
                            pathname: '/settings/relative-view',
                            params: { relatedPersonRef: grant.relatedPersonRef },
                          } as never)
                        }
                      />
                      <Button
                        kind={revokeConfirm ? 'destructive' : 'secondary'}
                        size="sm"
                        label={revokeConfirm ? t('familySharingRevokeConfirmCta') : t('familySharingRevokeCta')}
                        loading={revokeMutation.isPending && revokeConfirm}
                        disabled={revokeMutation.isPending || grantMutation.isPending}
                        onPress={() => (revokeConfirm ? void revokeGrant(grant) : setPendingRevokeGrantId(grant.id))}
                      />
                    </View>
                    {revokeConfirm ? (
                      <Text style={[typography.footnote, styles.hint, { color: c.textSecondary }]}>{t('familySharingRevokeConfirmHint')}</Text>
                    ) : null}
                  </Card>
                );
              })}
            </Stack>
          )}
        </View>

        {revokedGrants.length > 0 ? (
          <View>
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
                  trailing={<Badge label={t('familySharingRevokedAt')} tone="neutral" />}
                />
              ))}
            </ListGroup>
          </View>
        ) : null}

        <View>
          <SectionHeader title={t('familySharingScopeTitle')} />
          <ListGroup>
            <ListRow isFirst title={t('familySharingAllowedLine1')} trailing={<Ionicons name="checkmark-circle" size={20} color={c.success} />} />
            <ListRow title={t('familySharingAllowedLine2')} trailing={<Ionicons name="checkmark-circle" size={20} color={c.success} />} />
            <ListRow title={t('familySharingBlockedLine1')} trailing={<Ionicons name="close-circle" size={20} color={c.textTertiary} />} />
            <ListRow title={t('familySharingBlockedLine2')} trailing={<Ionicons name="close-circle" size={20} color={c.textTertiary} />} />
            <ListRow title={t('familySharingBlockedLine3')} trailing={<Ionicons name="close-circle" size={20} color={c.textTertiary} />} />
          </ListGroup>
        </View>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(3),
    padding: spacing(3),
    borderRadius: radius.md,
    borderWidth: 1,
  },
  grantActions: {
    flexDirection: 'row',
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(4),
  },
  hint: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(3),
  },
});
