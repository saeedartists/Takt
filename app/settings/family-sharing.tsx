import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  ListGroup,
  ListRow,
  LoadingState,
  PageHeader,
  PageShell,
  SectionHeader,
  SegmentedControl,
  Stack,
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

const RELATIONSHIP_OPTIONS = [
  { value: 'FAMMEMB', labelKey: 'familySharingRelationshipFamily' as const },
  { value: 'SPS', labelKey: 'familySharingRelationshipSpouse' as const },
  { value: 'CGV', labelKey: 'familySharingRelationshipCaregiver' as const },
] as const;

const normalize = (value: string): string => value.trim().toLowerCase();

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingRevokeGrantId, setPendingRevokeGrantId] = useState<string | null>(null);

  const grantedByRef = useMemo(
    () => ({ reference: patientRef ?? 'Patient/unknown' }),
    [patientRef],
  );

  const hasDuplicate = useMemo(() => {
    const first = normalize(givenName);
    const last = normalize(familyName);
    const mail = normalize(email);

    if (!first || !last) return false;

    return grants.relatedPeople.some((person) => {
      const personGiven = normalize(person.name?.[0]?.given?.[0] ?? '');
      const personFamily = normalize(person.name?.[0]?.family ?? '');
      const personEmail = normalize(person.telecom?.find((entry) => entry.system === 'email')?.value ?? '');
      const sameName = personGiven === first && personFamily === last;
      const sameEmail = Boolean(mail) && personEmail === mail;
      return sameName || sameEmail;
    });
  }, [email, familyName, givenName, grants.relatedPeople]);

  const submitGrant = async () => {
    setSubmitError(null);
    setSuccessMessage(null);

    if (!patientRef) {
      setSubmitError(t('familySharingNeedsPatient'));
      return;
    }

    if (!givenName.trim() || !familyName.trim()) {
      setSubmitError(t('familySharingNameRequired'));
      return;
    }

    if (hasDuplicate) {
      setSubmitError(t('familySharingDuplicateError'));
      return;
    }

    try {
      await grantMutation.mutateAsync({
        patientRef,
        givenName,
        familyName,
        relationshipCode,
        email: email.trim() ? email : undefined,
        grantedByRef,
      });

      setSuccessMessage(t('familySharingGrantSuccess'));
      setGivenName('');
      setFamilyName('');
      setEmail('');
      setRelationshipCode('FAMMEMB');
    } catch {
      setSubmitError(t('familySharingGrantError'));
    }
  };

  const requestRevoke = (grantId: string) => {
    setSubmitError(null);
    setSuccessMessage(null);
    setPendingRevokeGrantId(grantId);
  };

  const revokeGrant = async (grant: (typeof grants.grants)[number]) => {
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await revokeMutation.mutateAsync({
        grant,
        revokedByRef: grantedByRef,
      });
      setPendingRevokeGrantId(null);
      setSuccessMessage(t('familySharingRevokeSuccess'));
    } catch {
      setSubmitError(t('familySharingRevokeError'));
    }
  };

  if (patient.isLoading || grants.isLoading) {
    return (
      <PageShell>
        <LoadingState label={t('familySharingLoading')} />
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
      <PageHeader title={t('familySharingTitle')} subtitle={t('familySharingSubtitle')} />

      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(2.5) }}>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('familySharingV10Note')}</Text>
            <Badge label={t('familySharingV11Gate')} tone="warning" />
          </View>
        </Card>

        <View>
          <SectionHeader title={t('familySharingFlowTitle')} />
          <ListGroup>
            <ListRow isFirst title={t('familySharingFlowStep1')} value="1" />
            <ListRow title={t('familySharingFlowStep2')} value="2" />
            <ListRow title={t('familySharingFlowStep3')} value="3" />
          </ListGroup>
        </View>

        <View>
          <SectionHeader title={t('familySharingAddTitle')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <Field label={t('familySharingFirstNameLabel')}>
                <Input
                  value={givenName}
                  onChangeText={setGivenName}
                  placeholder={t('familySharingFirstNamePlaceholder')}
                />
              </Field>
              <Field label={t('familySharingLastNameLabel')}>
                <Input
                  value={familyName}
                  onChangeText={setFamilyName}
                  placeholder={t('familySharingLastNamePlaceholder')}
                />
              </Field>
              <Field label={t('familySharingEmailOptionalLabel')}>
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('familySharingEmailOptionalPlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
              </Field>
              <Field label={t('familySharingRelationshipLabel')}>
                <SegmentedControl
                  value={relationshipCode}
                  onChange={(next) =>
                    setRelationshipCode(next as (typeof RELATIONSHIP_OPTIONS)[number]['value'])
                  }
                  options={RELATIONSHIP_OPTIONS.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                />
              </Field>
              {hasDuplicate ? (
                <Badge label={t('familySharingDuplicateHint')} tone="warning" />
              ) : null}
              {submitError ? (
                <Text style={[typography.footnote, { color: c.destructive }]}>{submitError}</Text>
              ) : null}
              {successMessage ? (
                <Text style={[typography.footnote, { color: c.success }]}>{successMessage}</Text>
              ) : null}
              <Button
                label={grantMutation.isPending ? t('familySharingGranting') : t('familySharingGrantCta')}
                disabled={
                  grantMutation.isPending ||
                  revokeMutation.isPending ||
                  hasDuplicate ||
                  !givenName.trim() ||
                  !familyName.trim()
                }
                onPress={() => void submitGrant()}
              />
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader
            title={t('familySharingActiveListTitle').replace('{count}', activeGrants.length.toString())}
          />
          {activeGrants.length === 0 ? (
            <EmptyState
              title={t('familySharingNoGrants')}
              description={t('familySharingNoGrantsHint')}
            />
          ) : (
            <Stack>
              {activeGrants.map((grant) => {
                const relationLabel =
                  grant.relationshipCode === 'SPS'
                    ? t('familySharingRelationshipSpouse')
                    : grant.relationshipCode === 'CGV'
                      ? t('familySharingRelationshipCaregiver')
                      : t('familySharingRelationshipFamily');
                const revokeConfirm = pendingRevokeGrantId === grant.id;

                return (
                  <Card key={grant.id}>
                    <View style={{ padding: spacing(4), gap: spacing(3) }}>
                      <ListGroup>
                        <ListRow
                          isFirst
                          title={grant.relatedPersonLabel}
                          subtitle={`${relationLabel} · ${t('familySharingGrantedAt')}: ${formatDateTime(
                            new Date(grant.grantedAt),
                          )}`}
                          value={t('statusActive')}
                        />
                      </ListGroup>

                      <Button
                        kind="secondary"
                        label={t('familySharingOpenRelativeView')}
                        onPress={() =>
                          router.push({
                            pathname: '/settings/relative-view',
                            params: { relatedPersonRef: grant.relatedPersonRef },
                          } as never)
                        }
                      />

                      <Button
                        kind={revokeConfirm ? 'destructive' : 'secondary'}
                        label={
                          revokeMutation.isPending && revokeConfirm
                            ? t('familySharingRevoking')
                            : revokeConfirm
                              ? t('familySharingRevokeConfirmCta')
                              : t('familySharingRevokeCta')
                        }
                        disabled={revokeMutation.isPending || grantMutation.isPending}
                        onPress={() =>
                          revokeConfirm ? void revokeGrant(grant) : requestRevoke(grant.id)
                        }
                      />
                      {revokeConfirm ? (
                        <Text style={[typography.footnote, { color: c.textSecondary }]}>
                          {t('familySharingRevokeConfirmHint')}
                        </Text>
                      ) : null}
                    </View>
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
                  value={t('statusArchived')}
                />
              ))}
            </ListGroup>
          </View>
        ) : null}

        <View>
          <SectionHeader title={t('familySharingScopeTitle')} />
          <ListGroup>
            <ListRow isFirst title={t('familySharingAllowedLine1')} value="✓" />
            <ListRow title={t('familySharingAllowedLine2')} value="✓" />
            <ListRow title={t('familySharingBlockedLine1')} value="✕" />
            <ListRow title={t('familySharingBlockedLine2')} value="✕" />
            <ListRow title={t('familySharingBlockedLine3')} value="✕" />
          </ListGroup>
        </View>
      </Stack>
    </PageShell>
  );
}
