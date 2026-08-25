import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
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
import { useConsentEvents } from '@/lib/hooks/use-consent-events';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';
import { useReadinessChecklist } from '@/lib/takt/readiness-checklist';
import { type ConsentAuditCheckId, useConsentAudit } from '@/lib/takt/consent-audit';

const CHECK_ROWS: Array<{ id: ConsentAuditCheckId; titleKey: ConsentChecklistKey }> = [
  { id: 'grant-created', titleKey: 'consentAuditCheckGrant' },
  { id: 'withdraw-created', titleKey: 'consentAuditCheckWithdraw' },
  { id: 'timeline-reviewed', titleKey: 'consentAuditCheckTimeline' },
  { id: 'withdraw-route-confirmed', titleKey: 'consentAuditCheckRoute' },
  { id: 'evidence-exported', titleKey: 'consentAuditCheckEvidence' },
  { id: 'legal-copy-reviewed', titleKey: 'consentAuditCheckLegalCopy' },
];

type ConsentChecklistKey =
  | 'consentAuditCheckGrant'
  | 'consentAuditCheckWithdraw'
  | 'consentAuditCheckTimeline'
  | 'consentAuditCheckRoute'
  | 'consentAuditCheckEvidence'
  | 'consentAuditCheckLegalCopy';

export default function ConsentAuditScreen() {
  const { c } = useTokens();
  const { t, formatDateTime } = useLocale();
  const readiness = useReadinessChecklist();
  const audit = useConsentAudit();
  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const consents = useConsentEvents(patientRef);

  const consentStats = useMemo(() => {
    const rows = (consents.data?.entry ?? []).map((entry) => entry.resource);
    const active = rows.filter((row) => row.status === 'active');
    const inactive = rows.filter((row) => row.status === 'inactive');

    const latestActive = active[0]?.dateTime ? new Date(active[0].dateTime) : null;
    const latestInactive = inactive[0]?.dateTime ? new Date(inactive[0].dateTime) : null;

    return {
      total: rows.length,
      activeCount: active.length,
      inactiveCount: inactive.length,
      latestActive,
      latestInactive,
      traceable: active.length > 0 && inactive.length > 0,
    };
  }, [consents.data?.entry]);

  const allChecksDone = audit.done === audit.total;
  const verdictPass = audit.data.verdict === 'pass' || audit.data.verdict === 'minor-edits';
  const releasePass = allChecksDone && audit.metadataComplete && verdictPass && consentStats.traceable;

  useEffect(() => {
    if (readiness.isLoading) return;
    if (readiness.data['consent-audit'] === releasePass) return;
    void readiness.setTaskStatus('consent-audit', releasePass);
  }, [readiness, releasePass]);

  return (
    <PageShell>
      <PageHeader title={t('consentAuditTitle')} subtitle={t('consentAuditSubtitle')} />
      <Stack>
        <View>
          <SectionHeader title={t('consentAuditTraceTitle')} />
          {consents.isLoading || patient.isLoading ? (
            <LoadingState label={t('consentAuditLoading')} />
          ) : (
            <ListGroup>
              <ListRow isFirst title={t('consentAuditTotalEvents')} value={consentStats.total.toString()} />
              <ListRow title={t('consentAuditGrantEvents')} value={consentStats.activeCount.toString()} />
              <ListRow title={t('consentAuditWithdrawEvents')} value={consentStats.inactiveCount.toString()} />
              <ListRow
                title={t('consentAuditLatestGrant')}
                value={
                  consentStats.latestActive
                    ? formatDateTime(consentStats.latestActive)
                    : t('consentAuditNotObserved')
                }
              />
              <ListRow
                title={t('consentAuditLatestWithdraw')}
                value={
                  consentStats.latestInactive
                    ? formatDateTime(consentStats.latestInactive)
                    : t('consentAuditNotObserved')
                }
              />
              <ListRow
                title={t('consentAuditTraceability')}
                value={consentStats.traceable ? t('statusDone') : t('statusBlocked')}
                subtitle={
                  consentStats.traceable
                    ? t('consentAuditTraceabilityPass')
                    : t('consentAuditTraceabilityBlocked')
                }
              />
            </ListGroup>
          )}
        </View>

        <View>
          <SectionHeader title={t('consentAuditVerdict')} />
          <SegmentedControl
            value={audit.data.verdict}
            onChange={(next) => void audit.setVerdict(next as 'pending' | 'pass' | 'minor-edits' | 'fail')}
            options={[
              { value: 'pending', label: t('reportReviewVerdictPending') },
              { value: 'pass', label: t('reportReviewVerdictPass') },
              { value: 'minor-edits', label: t('reportReviewVerdictMinor') },
              { value: 'fail', label: t('reportReviewVerdictFail') },
            ]}
          />
        </View>

        <View>
          <SectionHeader title={t('consentAuditChecklist')} />
          <ListGroup>
            {CHECK_ROWS.map((item, index) => (
              <ListRow
                key={item.id}
                isFirst={index === 0}
                title={t(item.titleKey)}
                value={audit.data.checks[item.id] ? t('statusDone') : t('statusPending')}
                onPress={() => void audit.toggleCheck(item.id)}
              />
            ))}
          </ListGroup>
        </View>

        <View>
          <SectionHeader title={t('consentAuditEvidenceTitle')} />
          <View style={{ gap: spacing(3) }}>
            <Field label={t('consentAuditTesterName')}>
              <Input
                value={audit.data.testerName}
                onChangeText={(value) => void audit.updateMeta({ testerName: value })}
                placeholder={t('consentAuditTesterPlaceholder')}
              />
            </Field>
            <Field label={t('consentAuditReviewerRole')}>
              <Input
                value={audit.data.reviewerRole}
                onChangeText={(value) => void audit.updateMeta({ reviewerRole: value })}
                placeholder={t('consentAuditReviewerRolePlaceholder')}
              />
            </Field>
            <Field label={t('consentAuditReviewDate')}>
              <Input
                value={audit.data.reviewDate}
                onChangeText={(value) => void audit.updateMeta({ reviewDate: value })}
                placeholder={t('consentAuditReviewDatePlaceholder')}
              />
            </Field>
            <Field label={t('consentAuditEvidenceLinks')}>
              <Input
                value={audit.data.evidenceLinks}
                onChangeText={(value) => void audit.updateMeta({ evidenceLinks: value })}
                placeholder={t('consentAuditEvidenceLinksPlaceholder')}
                multiline
                textAlignVertical="top"
              />
            </Field>
            <Field label={t('consentAuditFindings')}>
              <Input
                value={audit.data.findings}
                onChangeText={(value) => void audit.updateMeta({ findings: value })}
                placeholder={t('consentAuditFindingsPlaceholder')}
                multiline
                textAlignVertical="top"
              />
            </Field>
          </View>
        </View>

        <Badge
          tone={releasePass ? 'success' : 'warning'}
          label={releasePass ? t('consentAuditGatePass') : t('consentAuditGateBlocked')}
        />

        {consents.error ? <Text style={[typography.footnote, { color: c.destructive }]}>{t('consentAuditLoadError')}</Text> : null}

        <Button
          kind="secondary"
          label={t('consentAuditReset')}
          onPress={() => void audit.reset()}
          disabled={audit.isSaving}
        />
      </Stack>
    </PageShell>
  );
}
