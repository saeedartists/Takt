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
import { type SessionQaCaseId, useSessionTokenMatrix } from '@/lib/takt/session-token-matrix';
import { useLocale } from '@/lib/takt/l10n';

const SESSION_CASES: Array<{
  id: SessionQaCaseId;
  priority: 'p0' | 'p1';
  titleKey:
    | 'sessionQaCase01Title'
    | 'sessionQaCase02Title'
    | 'sessionQaCase03Title'
    | 'sessionQaCase04Title'
    | 'sessionQaCase05Title'
    | 'sessionQaCase06Title'
    | 'sessionQaCase07Title'
    | 'sessionQaCase08Title'
    | 'sessionQaCase09Title'
    | 'sessionQaCase10Title'
    | 'sessionQaCase11Title'
    | 'sessionQaCase12Title'
    | 'sessionQaCase13Title'
    | 'sessionQaCase14Title';
  subtitleKey:
    | 'sessionQaCase01Subtitle'
    | 'sessionQaCase02Subtitle'
    | 'sessionQaCase03Subtitle'
    | 'sessionQaCase04Subtitle'
    | 'sessionQaCase05Subtitle'
    | 'sessionQaCase06Subtitle'
    | 'sessionQaCase07Subtitle'
    | 'sessionQaCase08Subtitle'
    | 'sessionQaCase09Subtitle'
    | 'sessionQaCase10Subtitle'
    | 'sessionQaCase11Subtitle'
    | 'sessionQaCase12Subtitle'
    | 'sessionQaCase13Subtitle'
    | 'sessionQaCase14Subtitle';
}> = [
  {
    id: 'st-01-sign-in-success',
    priority: 'p0',
    titleKey: 'sessionQaCase01Title',
    subtitleKey: 'sessionQaCase01Subtitle',
  },
  {
    id: 'st-02-sign-in-failure',
    priority: 'p0',
    titleKey: 'sessionQaCase02Title',
    subtitleKey: 'sessionQaCase02Subtitle',
  },
  {
    id: 'st-03-registration-success',
    priority: 'p0',
    titleKey: 'sessionQaCase03Title',
    subtitleKey: 'sessionQaCase03Subtitle',
  },
  {
    id: 'st-04-registration-duplicate-email',
    priority: 'p1',
    titleKey: 'sessionQaCase04Title',
    subtitleKey: 'sessionQaCase04Subtitle',
  },
  {
    id: 'st-05-sign-out',
    priority: 'p0',
    titleKey: 'sessionQaCase05Title',
    subtitleKey: 'sessionQaCase05Subtitle',
  },
  {
    id: 'st-06-app-restart-valid-session',
    priority: 'p0',
    titleKey: 'sessionQaCase06Title',
    subtitleKey: 'sessionQaCase06Subtitle',
  },
  {
    id: 'st-07-app-restart-after-sign-out',
    priority: 'p0',
    titleKey: 'sessionQaCase07Title',
    subtitleKey: 'sessionQaCase07Subtitle',
  },
  {
    id: 'st-08-invalid-token-handling',
    priority: 'p0',
    titleKey: 'sessionQaCase08Title',
    subtitleKey: 'sessionQaCase08Subtitle',
  },
  {
    id: 'st-09-protected-route-guard',
    priority: 'p0',
    titleKey: 'sessionQaCase09Title',
    subtitleKey: 'sessionQaCase09Subtitle',
  },
  {
    id: 'st-10-cross-account-switch',
    priority: 'p0',
    titleKey: 'sessionQaCase10Title',
    subtitleKey: 'sessionQaCase10Subtitle',
  },
  {
    id: 'st-11-consent-flow-continuity',
    priority: 'p1',
    titleKey: 'sessionQaCase11Title',
    subtitleKey: 'sessionQaCase11Subtitle',
  },
  {
    id: 'st-12-auth-endpoint-unavailable',
    priority: 'p1',
    titleKey: 'sessionQaCase12Title',
    subtitleKey: 'sessionQaCase12Subtitle',
  },
  {
    id: 'mp-01-malformed-fhir-payload',
    priority: 'p0',
    titleKey: 'sessionQaCase13Title',
    subtitleKey: 'sessionQaCase13Subtitle',
  },
  {
    id: 'mp-02-error-surfacing-quality',
    priority: 'p1',
    titleKey: 'sessionQaCase14Title',
    subtitleKey: 'sessionQaCase14Subtitle',
  },
];

export default function SessionSecurityScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const readiness = useReadinessChecklist();
  const matrix = useSessionTokenMatrix();

  useEffect(() => {
    if (readiness.isLoading) return;
    if (readiness.data['session-token-qa'] === matrix.isReleasePass) return;
    void readiness.setTaskStatus('session-token-qa', matrix.isReleasePass);
  }, [matrix.isReleasePass, readiness.data, readiness.isLoading, readiness.setTaskStatus]);

  return (
    <PageShell>
      <PageHeader title={t('sessionQaTitle')} subtitle={t('sessionQaSubtitle')} />

      <Stack>
        <View>
          <SectionHeader title={t('sessionQaProgressTitle')} />
          <ListGroup>
            <ListRow
              isFirst
              title={t('sessionQaCaseProgress')}
              value={`${matrix.done.toString()}/${matrix.total.toString()} · ${matrix.completionPct.toString()}%`}
            />
            <ListRow
              title={t('sessionQaP0Progress')}
              subtitle={t('sessionQaP0Hint')}
              value={`${matrix.p0Done.toString()}/${matrix.p0Total.toString()} · ${matrix.p0Pass ? t('statusDone') : t('statusPending')}`}
            />
            <ListRow
              title={t('sessionQaEvidence')}
              value={matrix.evidenceComplete ? t('statusDone') : t('statusPending')}
            />
          </ListGroup>
        </View>

        {matrix.isLoading ? (
          <LoadingState label={t('loadingSessionQa')} />
        ) : (
          <View>
            <SectionHeader title={t('sessionQaCasesTitle')} />
            <ListGroup>
              {SESSION_CASES.map((item, index) => (
                <ListRow
                  key={item.id}
                  isFirst={index === 0}
                  title={`${item.priority.toUpperCase()} · ${t(item.titleKey)}`}
                  subtitle={t(item.subtitleKey)}
                  value={matrix.data.cases[item.id] ? t('statusDone') : t('statusPending')}
                  onPress={() => void matrix.toggleCase(item.id)}
                />
              ))}
            </ListGroup>
          </View>
        )}

        <View>
          <SectionHeader title={t('sessionQaEvidenceTitle')} />
          <View style={{ gap: spacing(3) }}>
            <Field label={t('sessionQaTesterName')}>
              <Input
                value={matrix.data.testerName}
                onChangeText={(value) => void matrix.updateMeta({ testerName: value })}
                placeholder={t('sessionQaTesterPlaceholder')}
                autoCapitalize="words"
              />
            </Field>

            <Field label={t('sessionQaRunDate')}>
              <Input
                value={matrix.data.runDate}
                onChangeText={(value) => void matrix.updateMeta({ runDate: value })}
                placeholder={t('sessionQaRunDatePlaceholder')}
              />
            </Field>

            <Field label={t('sessionQaDeviceSummary')}>
              <Input
                value={matrix.data.deviceSummary}
                onChangeText={(value) => void matrix.updateMeta({ deviceSummary: value })}
                placeholder={t('sessionQaDevicePlaceholder')}
              />
            </Field>

            <Field label={t('sessionQaAppVersion')}>
              <Input
                value={matrix.data.appVersion}
                onChangeText={(value) => void matrix.updateMeta({ appVersion: value })}
                placeholder={t('sessionQaAppVersionPlaceholder')}
              />
            </Field>

            <Field label={t('sessionQaEvidenceLinks')}>
              <Input
                value={matrix.data.evidenceLinks}
                onChangeText={(value) => void matrix.updateMeta({ evidenceLinks: value })}
                placeholder={t('sessionQaEvidenceLinksPlaceholder')}
                multiline
                textAlignVertical="top"
              />
            </Field>

            <Field label={t('sessionQaNotes')}>
              <Input
                value={matrix.data.notes}
                onChangeText={(value) => void matrix.updateMeta({ notes: value })}
                placeholder={t('sessionQaNotesPlaceholder')}
                multiline
                textAlignVertical="top"
              />
            </Field>

            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('sessionQaEvidenceHint')}</Text>
          </View>
        </View>

        <View>
          <SectionHeader title={t('sessionQaGateTitle')} />
          <Badge
            tone={matrix.isReleasePass ? 'success' : 'warning'}
            label={matrix.isReleasePass ? t('sessionQaGatePass') : t('sessionQaGateBlocked')}
          />
        </View>

        <Button
          kind="secondary"
          label={t('sessionQaReset')}
          onPress={() => void matrix.reset()}
          disabled={matrix.isSaving || matrix.isLoading}
        />
      </Stack>
    </PageShell>
  );
}
