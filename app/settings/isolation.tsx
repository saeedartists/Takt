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
  Stack,
  spacing,
  typography,
  useTokens,
} from '@/components/ui';
import { useReadinessChecklist } from '@/lib/takt/readiness-checklist';
import { type IsolationCaseId, useIsolationMatrix } from '@/lib/takt/isolation-matrix';
import { useLocale } from '@/lib/takt/l10n';

const CASE_CONFIG: Array<{
  id: IsolationCaseId;
  titleKey:
    | 'isolationCaseAReadsATitle'
    | 'isolationCaseAReadsBDeniedTitle'
    | 'isolationCaseAWritesBDeniedTitle'
    | 'isolationCaseBReadsBTitle'
    | 'isolationCaseBReadsADeniedTitle'
    | 'isolationCaseBWritesADeniedTitle';
  subtitleKey:
    | 'isolationCaseAReadsASubtitle'
    | 'isolationCaseAReadsBDeniedSubtitle'
    | 'isolationCaseAWritesBDeniedSubtitle'
    | 'isolationCaseBReadsBSubtitle'
    | 'isolationCaseBReadsADeniedSubtitle'
    | 'isolationCaseBWritesADeniedSubtitle';
}> = [
  { id: 'a-reads-a', titleKey: 'isolationCaseAReadsATitle', subtitleKey: 'isolationCaseAReadsASubtitle' },
  {
    id: 'a-reads-b-denied',
    titleKey: 'isolationCaseAReadsBDeniedTitle',
    subtitleKey: 'isolationCaseAReadsBDeniedSubtitle',
  },
  {
    id: 'a-writes-b-denied',
    titleKey: 'isolationCaseAWritesBDeniedTitle',
    subtitleKey: 'isolationCaseAWritesBDeniedSubtitle',
  },
  { id: 'b-reads-b', titleKey: 'isolationCaseBReadsBTitle', subtitleKey: 'isolationCaseBReadsBSubtitle' },
  {
    id: 'b-reads-a-denied',
    titleKey: 'isolationCaseBReadsADeniedTitle',
    subtitleKey: 'isolationCaseBReadsADeniedSubtitle',
  },
  {
    id: 'b-writes-a-denied',
    titleKey: 'isolationCaseBWritesADeniedTitle',
    subtitleKey: 'isolationCaseBWritesADeniedSubtitle',
  },
];

export default function IsolationScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const matrix = useIsolationMatrix();
  const readiness = useReadinessChecklist();

  useEffect(() => {
    if (readiness.isLoading) return;
    if (readiness.data['patient-isolation'] === matrix.isPass) return;
    void readiness.setTaskStatus('patient-isolation', matrix.isPass);
  }, [matrix.isPass, readiness.data, readiness.isLoading, readiness.setTaskStatus]);

  return (
    <PageShell>
      <PageHeader title={t('isolationTitle')} subtitle={t('isolationSubtitle')} />
      <Stack>
        <View>
          <SectionHeader title={t('isolationProgressTitle')} />
          <ListGroup>
            <ListRow
              isFirst
              title={t('isolationProgressCases')}
              value={`${matrix.done.toString()}/${matrix.total.toString()} · ${matrix.completionPct.toString()}%`}
            />
            <ListRow
              title={t('isolationProgressVerdict')}
              value={matrix.isPass ? t('statusDone') : t('statusPending')}
              subtitle={matrix.isPass ? t('isolationVerdictPass') : t('isolationVerdictPending')}
            />
          </ListGroup>
        </View>

        {matrix.isLoading ? (
          <LoadingState label={t('loadingIsolationMatrix')} />
        ) : (
          <View>
            <SectionHeader title={t('isolationCasesTitle')} />
            <ListGroup>
              {CASE_CONFIG.map((item, index) => (
                <ListRow
                  key={item.id}
                  isFirst={index === 0}
                  title={t(item.titleKey)}
                  subtitle={t(item.subtitleKey)}
                  value={matrix.data.cases[item.id] ? t('statusDone') : t('statusPending')}
                  onPress={() => void matrix.toggleCase(item.id)}
                />
              ))}
            </ListGroup>
          </View>
        )}

        <View>
          <SectionHeader title={t('isolationEvidenceTitle')} />
          <View style={{ gap: spacing(3) }}>
            <Field label={t('isolationTesterName')}>
              <Input
                value={matrix.data.testerName}
                onChangeText={(value) => void matrix.updateMeta({ testerName: value })}
                placeholder={t('isolationTesterNamePlaceholder')}
                autoCapitalize="words"
              />
            </Field>

            <Field label={t('isolationRunDate')}>
              <Input
                value={matrix.data.runDate}
                onChangeText={(value) => void matrix.updateMeta({ runDate: value })}
                placeholder={t('isolationRunDatePlaceholder')}
              />
            </Field>

            <Field label={t('isolationNotes')}>
              <Input
                value={matrix.data.notes}
                onChangeText={(value) => void matrix.updateMeta({ notes: value })}
                placeholder={t('isolationNotesPlaceholder')}
                multiline
                textAlignVertical="top"
              />
            </Field>

            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('isolationEvidenceHint')}</Text>
          </View>
        </View>

        <Button
          kind="secondary"
          label={t('isolationReset')}
          onPress={() => void matrix.reset()}
          disabled={matrix.isSaving || matrix.isLoading}
        />
      </Stack>
    </PageShell>
  );
}
