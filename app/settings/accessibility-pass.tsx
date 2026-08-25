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
import { type A11yCaseId, useAccessibilityPass } from '@/lib/takt/accessibility-pass';
import { useLocale } from '@/lib/takt/l10n';
import { useReadinessChecklist } from '@/lib/takt/readiness-checklist';

const A11Y_CASES: Array<{
  id: A11yCaseId;
  titleKey:
    | 'a11yCaseLargeTextTodayTitle'
    | 'a11yCaseLargeTextMedsTitle'
    | 'a11yCaseLargeTextHistoryTitle'
    | 'a11yCaseScreenReaderTabTitle'
    | 'a11yCaseScreenReaderDoseTitle'
    | 'a11yCaseNonColorTitle'
    | 'a11yCaseFocusOrderTitle'
    | 'a11yCaseRotationTitle';
  subtitleKey:
    | 'a11yCaseLargeTextTodaySubtitle'
    | 'a11yCaseLargeTextMedsSubtitle'
    | 'a11yCaseLargeTextHistorySubtitle'
    | 'a11yCaseScreenReaderTabSubtitle'
    | 'a11yCaseScreenReaderDoseSubtitle'
    | 'a11yCaseNonColorSubtitle'
    | 'a11yCaseFocusOrderSubtitle'
    | 'a11yCaseRotationSubtitle';
}> = [
  {
    id: 'a-large-text-today',
    titleKey: 'a11yCaseLargeTextTodayTitle',
    subtitleKey: 'a11yCaseLargeTextTodaySubtitle',
  },
  {
    id: 'b-large-text-medications',
    titleKey: 'a11yCaseLargeTextMedsTitle',
    subtitleKey: 'a11yCaseLargeTextMedsSubtitle',
  },
  {
    id: 'c-large-text-history',
    titleKey: 'a11yCaseLargeTextHistoryTitle',
    subtitleKey: 'a11yCaseLargeTextHistorySubtitle',
  },
  {
    id: 'd-screen-reader-tab-flow',
    titleKey: 'a11yCaseScreenReaderTabTitle',
    subtitleKey: 'a11yCaseScreenReaderTabSubtitle',
  },
  {
    id: 'e-screen-reader-dose-actions',
    titleKey: 'a11yCaseScreenReaderDoseTitle',
    subtitleKey: 'a11yCaseScreenReaderDoseSubtitle',
  },
  {
    id: 'f-non-color-status-cues',
    titleKey: 'a11yCaseNonColorTitle',
    subtitleKey: 'a11yCaseNonColorSubtitle',
  },
  {
    id: 'g-focus-order-critical-flows',
    titleKey: 'a11yCaseFocusOrderTitle',
    subtitleKey: 'a11yCaseFocusOrderSubtitle',
  },
  {
    id: 'h-rotation-layout-stability',
    titleKey: 'a11yCaseRotationTitle',
    subtitleKey: 'a11yCaseRotationSubtitle',
  },
];

export default function AccessibilityPassScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const matrix = useAccessibilityPass();
  const readiness = useReadinessChecklist();

  useEffect(() => {
    if (readiness.isLoading) return;
    if (readiness.data['a11y-pass'] === matrix.isPass) return;
    void readiness.setTaskStatus('a11y-pass', matrix.isPass);
  }, [matrix.isPass, readiness.data, readiness.isLoading, readiness.setTaskStatus]);

  return (
    <PageShell>
      <PageHeader title={t('a11yPassTitle')} subtitle={t('a11yPassSubtitle')} />

      <Stack>
        <View>
          <SectionHeader title={t('a11yProgressTitle')} />
          <ListGroup>
            <ListRow
              isFirst
              title={t('a11yCaseProgress')}
              value={`${matrix.done.toString()}/${matrix.total.toString()} · ${matrix.completionPct.toString()}%`}
            />
            <ListRow
              title={t('a11yEvidenceProgress')}
              subtitle={t('a11yEvidenceHint')}
              value={matrix.evidenceComplete ? t('statusDone') : t('statusPending')}
            />
          </ListGroup>
        </View>

        {matrix.isLoading ? (
          <LoadingState label={t('loadingA11yPass')} />
        ) : (
          <View>
            <SectionHeader title={t('a11yCasesTitle')} />
            <ListGroup>
              {A11Y_CASES.map((item, index) => (
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
          <SectionHeader title={t('a11yEvidenceTitle')} />
          <View style={{ gap: spacing(3) }}>
            <Field label={t('a11yTesterName')}>
              <Input
                value={matrix.data.testerName}
                onChangeText={(value) => void matrix.updateMeta({ testerName: value })}
                placeholder={t('a11yTesterPlaceholder')}
                autoCapitalize="words"
              />
            </Field>

            <Field label={t('a11yRunDate')}>
              <Input
                value={matrix.data.runDate}
                onChangeText={(value) => void matrix.updateMeta({ runDate: value })}
                placeholder={t('a11yRunDatePlaceholder')}
              />
            </Field>

            <Field label={t('a11yDeviceSummary')}>
              <Input
                value={matrix.data.deviceSummary}
                onChangeText={(value) => void matrix.updateMeta({ deviceSummary: value })}
                placeholder={t('a11yDevicePlaceholder')}
              />
            </Field>

            <Field label={t('a11yAssistiveTech')}>
              <Input
                value={matrix.data.assistiveTechUsed}
                onChangeText={(value) => void matrix.updateMeta({ assistiveTechUsed: value })}
                placeholder={t('a11yAssistiveTechPlaceholder')}
              />
            </Field>

            <Field label={t('a11yEvidenceLinks')}>
              <Input
                value={matrix.data.evidenceLinks}
                onChangeText={(value) => void matrix.updateMeta({ evidenceLinks: value })}
                placeholder={t('a11yEvidenceLinksPlaceholder')}
                multiline
                textAlignVertical="top"
              />
            </Field>

            <Field label={t('a11yNotes')}>
              <Input
                value={matrix.data.notes}
                onChangeText={(value) => void matrix.updateMeta({ notes: value })}
                placeholder={t('a11yNotesPlaceholder')}
                multiline
                textAlignVertical="top"
              />
            </Field>

            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('a11yEvidenceFootnote')}</Text>
          </View>
        </View>

        <Badge
          tone={matrix.isPass ? 'success' : 'warning'}
          label={matrix.isPass ? t('a11yGatePass') : t('a11yGateBlocked')}
        />

        <Button
          kind="secondary"
          label={t('a11yReset')}
          onPress={() => void matrix.reset()}
          disabled={matrix.isSaving || matrix.isLoading}
        />
      </Stack>
    </PageShell>
  );
}
