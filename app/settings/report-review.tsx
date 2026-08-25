import { useEffect } from 'react';
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
import { useLocale } from '@/lib/takt/l10n';
import { useReadinessChecklist } from '@/lib/takt/readiness-checklist';
import { type ReportReviewCheckId, useReportReview } from '@/lib/takt/report-review';

const CHECK_ROWS: Array<{
  id: ReportReviewCheckId;
  titleKey:
    | 'reportReviewCheckIdentity'
    | 'reportReviewCheckWindow'
    | 'reportReviewCheckAdherence'
    | 'reportReviewCheckPerMed'
    | 'reportReviewCheckMissedRisk'
    | 'reportReviewCheckNoRecommendation'
    | 'reportReviewCheckBoundary'
    | 'reportReviewCheckDisclaimer'
    | 'reportReviewCheckOnePage'
    | 'reportReviewCheckReadability'
    | 'reportReviewCheckTerminology'
    | 'reportReviewCheckDensity'
    | 'reportReviewCheckEn'
    | 'reportReviewCheckDe'
    | 'reportReviewCheckDrift';
}> = [
  { id: 'a-identity-clear', titleKey: 'reportReviewCheckIdentity' },
  { id: 'a-window-clear', titleKey: 'reportReviewCheckWindow' },
  { id: 'a-adherence-readable', titleKey: 'reportReviewCheckAdherence' },
  { id: 'a-medication-actionable', titleKey: 'reportReviewCheckPerMed' },
  { id: 'a-missed-risk-clear', titleKey: 'reportReviewCheckMissedRisk' },
  { id: 'b-no-treatment-recommendation', titleKey: 'reportReviewCheckNoRecommendation' },
  { id: 'b-boundary-clear', titleKey: 'reportReviewCheckBoundary' },
  { id: 'b-disclaimer-clear', titleKey: 'reportReviewCheckDisclaimer' },
  { id: 'c-one-page-practical', titleKey: 'reportReviewCheckOnePage' },
  { id: 'c-readability-print', titleKey: 'reportReviewCheckReadability' },
  { id: 'c-terminology-fit', titleKey: 'reportReviewCheckTerminology' },
  { id: 'c-density-balanced', titleKey: 'reportReviewCheckDensity' },
  { id: 'd-en-natural', titleKey: 'reportReviewCheckEn' },
  { id: 'd-de-natural', titleKey: 'reportReviewCheckDe' },
  { id: 'd-no-translation-drift', titleKey: 'reportReviewCheckDrift' },
];

export default function ReportReviewScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const readiness = useReadinessChecklist();
  const review = useReportReview();

  useEffect(() => {
    if (readiness.isLoading) return;
    if (readiness.data['report-pdf-reviewed'] === review.releasePass) return;
    void readiness.setTaskStatus('report-pdf-reviewed', review.releasePass);
  }, [readiness, review.releasePass]);

  return (
    <PageShell>
      <PageHeader title={t('reportReviewTitle')} subtitle={t('reportReviewSubtitle')} />

      <Stack>
        <View>
          <SectionHeader title={t('reportReviewProgressTitle')} />
          <ListGroup>
            <ListRow
              isFirst
              title={t('reportReviewChecksDone')}
              value={`${review.done.toString()}/${review.total.toString()} · ${review.completionPct.toString()}%`}
            />
            <ListRow
              title={t('reportReviewEvidenceDone')}
              value={review.reviewerMetaComplete ? t('statusDone') : t('statusPending')}
            />
            <ListRow
              title={t('reportReviewGate')}
              value={review.releasePass ? t('statusDone') : t('statusPending')}
              subtitle={review.releasePass ? t('reportReviewGatePass') : t('reportReviewGateBlocked')}
            />
          </ListGroup>
        </View>

        <View>
          <SectionHeader title={t('reportReviewVerdict')} />
          <SegmentedControl
            value={review.data.verdict}
            onChange={(next) => void review.setVerdict(next as 'pending' | 'pass' | 'minor-edits' | 'fail')}
            options={[
              { value: 'pending', label: t('reportReviewVerdictPending') },
              { value: 'pass', label: t('reportReviewVerdictPass') },
              { value: 'minor-edits', label: t('reportReviewVerdictMinor') },
              { value: 'fail', label: t('reportReviewVerdictFail') },
            ]}
          />
        </View>

        {review.isLoading ? (
          <LoadingState label={t('reportReviewLoading')} />
        ) : (
          <View>
            <SectionHeader title={t('reportReviewChecklist')} />
            <ListGroup>
              {CHECK_ROWS.map((item, index) => (
                <ListRow
                  key={item.id}
                  isFirst={index === 0}
                  title={t(item.titleKey)}
                  value={review.data.checks[item.id] ? t('statusDone') : t('statusPending')}
                  onPress={() => void review.toggleCheck(item.id)}
                />
              ))}
            </ListGroup>
          </View>
        )}

        <View>
          <SectionHeader title={t('reportReviewReviewerProfile')} />
          <View style={{ gap: spacing(3) }}>
            <Field label={t('reportReviewName')}>
              <Input
                value={review.data.reviewerName}
                onChangeText={(value) => void review.updateMeta({ reviewerName: value })}
                placeholder={t('reportReviewNamePlaceholder')}
                autoCapitalize="words"
              />
            </Field>

            <Field label={t('reportReviewRole')}>
              <Input
                value={review.data.reviewerRole}
                onChangeText={(value) => void review.updateMeta({ reviewerRole: value })}
                placeholder={t('reportReviewRolePlaceholder')}
                autoCapitalize="words"
              />
            </Field>

            <Field label={t('reportReviewSpecialty')}>
              <Input
                value={review.data.reviewerSpecialty}
                onChangeText={(value) => void review.updateMeta({ reviewerSpecialty: value })}
                placeholder={t('reportReviewSpecialtyPlaceholder')}
              />
            </Field>

            <Field label={t('reportReviewDate')}>
              <Input
                value={review.data.reviewDate}
                onChangeText={(value) => void review.updateMeta({ reviewDate: value })}
                placeholder={t('reportReviewDatePlaceholder')}
              />
            </Field>

            <Field label={t('reportReviewSampleCount')}>
              <Input
                value={review.data.sampleCount}
                onChangeText={(value) => void review.updateMeta({ sampleCount: value })}
                placeholder={t('reportReviewSampleCountPlaceholder')}
                keyboardType="number-pad"
              />
            </Field>
          </View>
        </View>

        <View>
          <SectionHeader title={t('reportReviewChangesTitle')} />
          <View style={{ gap: spacing(3) }}>
            <Field label={t('reportReviewRequiredChanges')}>
              <Input
                value={review.data.requiredChanges}
                onChangeText={(value) => void review.updateMeta({ requiredChanges: value })}
                placeholder={t('reportReviewRequiredChangesPlaceholder')}
                multiline
                textAlignVertical="top"
              />
            </Field>

            <Field label={t('reportReviewPriorityBeforeRelease')}>
              <Input
                value={review.data.priorityBeforeRelease}
                onChangeText={(value) => void review.updateMeta({ priorityBeforeRelease: value })}
                placeholder={t('reportReviewPriorityBeforeReleasePlaceholder')}
                multiline
                textAlignVertical="top"
              />
            </Field>

            <Field label={t('reportReviewOptionalPostV1')}>
              <Input
                value={review.data.optionalPostV1}
                onChangeText={(value) => void review.updateMeta({ optionalPostV1: value })}
                placeholder={t('reportReviewOptionalPostV1Placeholder')}
                multiline
                textAlignVertical="top"
              />
            </Field>

            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('reportReviewHint')}</Text>
          </View>
        </View>

        <Badge
          tone={review.releasePass ? 'success' : 'warning'}
          label={review.releasePass ? t('reportReviewReleasePass') : t('reportReviewReleaseBlocked')}
        />

        <Button
          kind="secondary"
          label={t('reportReviewReset')}
          onPress={() => void review.reset()}
          disabled={review.isSaving || review.isLoading}
        />
      </Stack>
    </PageShell>
  );
}
