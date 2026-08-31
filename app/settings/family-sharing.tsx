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
  { value: 'FAMMEMB', label: 'Family' },
  { value: 'SPS', label: 'Spouse' },
  { value: 'CGV', label: 'Caregiver' },
] as const;

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
  const [relationshipCode, setRelationshipCode] = useState<(typeof RELATIONSHIP_OPTIONS)[number]['value']>('FAMMEMB');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const grantedByRef = useMemo(
    () => ({ reference: patientRef ?? 'Patient/unknown' }),
    [patientRef],
  );

  const submitGrant = async () => {
    setSubmitError(null);

    if (!patientRef) {
      setSubmitError(t('familySharingNeedsPatient'));
      return;
    }

    if (!givenName.trim() || !familyName.trim()) {
      setSubmitError(t('familySharingNameRequired'));
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

      setGivenName('');
      setFamilyName('');
      setEmail('');
      setRelationshipCode('FAMMEMB');
    } catch {
      setSubmitError(t('familySharingGrantError'));
    }
  };

  const revokeGrant = async (grant: (typeof grants.grants)[number]) => {
    setSubmitError(null);

    try {
      await revokeMutation.mutateAsync({
        grant,
        revokedByRef: grantedByRef,
      });
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
          <SectionHeader title={t('familySharingAddTitle')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <Field label={t('familySharingFirstNameLabel')}>
                <Input value={givenName} onChangeText={setGivenName} placeholder={t('familySharingFirstNamePlaceholder')} />
              </Field>
              <Field label={t('familySharingLastNameLabel')}>
                <Input value={familyName} onChangeText={setFamilyName} placeholder={t('familySharingLastNamePlaceholder')} />
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
                  onChange={(next) => setRelationshipCode(next as (typeof RELATIONSHIP_OPTIONS)[number]['value'])}
                  options={RELATIONSHIP_OPTIONS.map((option) => ({
                    value: option.value,
                    label:
                      option.value === 'SPS'
                        ? t('familySharingRelationshipSpouse')
                        : option.value === 'CGV'
                          ? t('familySharingRelationshipCaregiver')
                          : t('familySharingRelationshipFamily'),
                  }))}
                />
              </Field>
              {submitError ? <Text style={[typography.footnote, { color: c.destructive }]}>{submitError}</Text> : null}
              <Button
                label={grantMutation.isPending ? t('familySharingGranting') : t('familySharingGrantCta')}
                disabled={grantMutation.isPending || revokeMutation.isPending}
                onPress={() => void submitGrant()}
              />
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title={t('familySharingGrantListTitle')} />
          {grants.grants.length === 0 ? (
            <EmptyState title={t('familySharingNoGrants')} description={t('familySharingNoGrantsHint')} />
          ) : (
            <Stack>
              {grants.grants.map((grant) => {
                const statusLabel = grant.status === 'granted' ? t('statusActive') : t('statusArchived');
                const relationLabel =
                  grant.relationshipCode === 'SPS'
                    ? t('familySharingRelationshipSpouse')
                    : grant.relationshipCode === 'CGV'
                      ? t('familySharingRelationshipCaregiver')
                      : t('familySharingRelationshipFamily');

                return (
                  <Card key={grant.id}>
                    <View style={{ padding: spacing(4), gap: spacing(3) }}>
                      <ListGroup>
                        <ListRow
                          isFirst
                          title={grant.relatedPersonLabel}
                          subtitle={`${relationLabel} · ${t('familySharingGrantedAt')}: ${formatDateTime(new Date(grant.grantedAt))}`}
                          value={statusLabel}
                        />
                        {grant.revokedAt ? (
                          <ListRow
                            title={t('familySharingRevokedAt')}
                            subtitle={formatDateTime(new Date(grant.revokedAt))}
                          />
                        ) : null}
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

                      {grant.status === 'granted' ? (
                        <Button
                          kind="destructive"
                          label={
                            revokeMutation.isPending
                              ? t('familySharingRevoking')
                              : t('familySharingRevokeCta')
                          }
                          disabled={revokeMutation.isPending || grantMutation.isPending}
                          onPress={() => void revokeGrant(grant)}
                        />
                      ) : null}
                    </View>
                  </Card>
                );
              })}
            </Stack>
          )}
        </View>

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
