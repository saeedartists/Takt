import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
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
import { resolveSessionGate, type SessionGateResult } from '@/lib/auth-session';
import { useProjectSettings } from '@/lib/hooks/use-project-settings';
import { env } from '@/lib/env';
import { useReadinessChecklist, type ReadinessTaskId } from '@/lib/takt/readiness-checklist';
import { useLocale } from '@/lib/takt/l10n';

type ReadinessTone = 'success' | 'warning' | 'neutral';

type PhaseState = 'done' | 'in-progress' | 'blocked' | 'pending';

const TASKS: Array<{
  id: ReadinessTaskId;
  titleKey:
    | 'readinessTaskAuthSmokeTitle'
    | 'readinessTaskIsolationTitle'
    | 'readinessTaskReminderIosTitle'
    | 'readinessTaskReminderAndroidTitle'
    | 'readinessTaskTimezoneTitle'
    | 'readinessTaskReportTitle'
    | 'readinessTaskConsentTitle'
    | 'readinessTaskA11yTitle';
  subtitleKey:
    | 'readinessTaskAuthSmokeSubtitle'
    | 'readinessTaskIsolationSubtitle'
    | 'readinessTaskReminderIosSubtitle'
    | 'readinessTaskReminderAndroidSubtitle'
    | 'readinessTaskTimezoneSubtitle'
    | 'readinessTaskReportSubtitle'
    | 'readinessTaskConsentSubtitle'
    | 'readinessTaskA11ySubtitle';
}> = [
  {
    id: 'auth-live-smoke',
    titleKey: 'readinessTaskAuthSmokeTitle',
    subtitleKey: 'readinessTaskAuthSmokeSubtitle',
  },
  {
    id: 'patient-isolation',
    titleKey: 'readinessTaskIsolationTitle',
    subtitleKey: 'readinessTaskIsolationSubtitle',
  },
  {
    id: 'reminder-ios-closed',
    titleKey: 'readinessTaskReminderIosTitle',
    subtitleKey: 'readinessTaskReminderIosSubtitle',
  },
  {
    id: 'reminder-android-closed',
    titleKey: 'readinessTaskReminderAndroidTitle',
    subtitleKey: 'readinessTaskReminderAndroidSubtitle',
  },
  {
    id: 'timezone-dst',
    titleKey: 'readinessTaskTimezoneTitle',
    subtitleKey: 'readinessTaskTimezoneSubtitle',
  },
  {
    id: 'report-pdf-reviewed',
    titleKey: 'readinessTaskReportTitle',
    subtitleKey: 'readinessTaskReportSubtitle',
  },
  {
    id: 'consent-audit',
    titleKey: 'readinessTaskConsentTitle',
    subtitleKey: 'readinessTaskConsentSubtitle',
  },
  {
    id: 'a11y-pass',
    titleKey: 'readinessTaskA11yTitle',
    subtitleKey: 'readinessTaskA11ySubtitle',
  },
];

const yesNo = (ok: boolean, yes: string, no: string) => (ok ? yes : no);

const phaseTone = (value: PhaseState): ReadinessTone => {
  if (value === 'done') return 'success';
  if (value === 'in-progress') return 'neutral';
  return 'warning';
};

export default function ReadinessScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const [gate, setGate] = useState<SessionGateResult | null>(null);
  const checklist = useReadinessChecklist();
  const projectSettings = useProjectSettings();

  useEffect(() => {
    let active = true;
    void resolveSessionGate().then((result) => {
      if (active) setGate(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const phaseLabel = (value: PhaseState): string => {
    if (value === 'done') return t('statusDone');
    if (value === 'in-progress') return t('statusInProgress');
    if (value === 'blocked') return t('statusBlocked');
    return t('statusPending');
  };

  const hasApiUrl = Boolean(env.ovokApiUrl);
  const hasTenantCode = Boolean(env.ovokTenantCode);
  const mockDisabled = !env.ovokMockEnabled;
  const envReady = hasApiUrl && hasTenantCode && mockDisabled;

  const authReachable = gate ? gate.kind === 'authenticated' || gate.kind === 'unauthenticated' : false;
  const patientLoginEnabled = projectSettings.data?.PATIENT_LOGIN_ENABLED ?? false;
  const patientRegistrationEnabled = projectSettings.data?.PATIENT_REGISTRATION_ENABLED ?? false;
  const flagsReady = patientLoginEnabled && patientRegistrationEnabled;
  const flagsAvailable = projectSettings.isSuccess || env.ovokMockEnabled;

  const phase1: PhaseState = !envReady
    ? 'pending'
    : !authReachable
      ? 'blocked'
      : !flagsReady
        ? 'blocked'
        : checklist.data['auth-live-smoke']
          ? 'done'
          : 'in-progress';

  const checklistTone: ReadinessTone = checklist.completionPct === 100 ? 'success' : 'neutral';

  const blockers = useMemo(() => {
    const infraBlockers =
      Number(!envReady) +
      Number(!authReachable) +
      Number(!flagsReady) +
      Number(!flagsAvailable && !projectSettings.isLoading);
    return infraBlockers + (checklist.total - checklist.done);
  }, [
    authReachable,
    checklist.done,
    checklist.total,
    envReady,
    flagsAvailable,
    flagsReady,
    projectSettings.isLoading,
  ]);

  return (
    <PageShell>
      <PageHeader title={t('readinessTitle')} subtitle={t('readinessSubtitle')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('readinessSummaryTitle')}</Text>
            <Badge label={t('readinessBlockedCount').replace('{count}', blockers.toString())} tone={blockers === 0 ? 'success' : 'warning'} />
            <Text style={[typography.footnote, { color: c.textSecondary }]}>
              {!authReachable
                ? t('readinessAuthOffline')
                : !flagsReady
                  ? t('readinessFlagsBlocked')
                  : t('readinessAuthNeedsSignIn')}
            </Text>
          </View>
        </Card>

        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('readinessPhase1Title')}</Text>
            <Badge label={phaseLabel(phase1)} tone={phaseTone(phase1)} />
            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('readinessBackendFlagsHint')}</Text>
          </View>
        </Card>

        <View>
          <SectionHeader title={t('readinessPhase1Checks')} />
          <ListGroup>
            <ListRow isFirst title={t('readinessApiUrl')} subtitle={yesNo(hasApiUrl, t('statusDone'), t('statusPending'))} />
            <ListRow title={t('readinessTenantCode')} subtitle={yesNo(hasTenantCode, t('statusDone'), t('statusPending'))} />
            <ListRow title={t('readinessMockMode')} subtitle={yesNo(mockDisabled, t('statusDone'), t('statusPending'))} />
            <ListRow
              title={t('readinessAuthProbe')}
              subtitle={
                gate === null
                  ? t('statusLoading')
                  : authReachable
                    ? t('readinessAuthReachable')
                    : t('readinessAuthBlocked')
              }
            />
            <ListRow
              title={t('readinessBackendFlags')}
              subtitle={
                projectSettings.isLoading
                  ? t('statusLoading')
                  : flagsAvailable
                    ? t('statusDone')
                    : t('readinessSettingsUnavailable')
              }
            />
            <ListRow
              title={t('readinessPatientLogin')}
              subtitle={
                projectSettings.isLoading
                  ? t('statusLoading')
                  : yesNo(patientLoginEnabled, t('statusDone'), t('statusBlocked'))
              }
            />
            <ListRow
              title={t('readinessPatientRegistration')}
              subtitle={
                projectSettings.isLoading
                  ? t('statusLoading')
                  : yesNo(patientRegistrationEnabled, t('statusDone'), t('statusBlocked'))
              }
            />
          </ListGroup>
        </View>

        <View>
          <SectionHeader title={t('readinessChecklistTitle')} />
          <Card>
            <View style={{ padding: spacing(4), gap: spacing(3) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('readinessChecklistProgress')}</Text>
                <Badge
                  label={`${checklist.done.toString()}/${checklist.total.toString()} · ${checklist.completionPct.toString()}%`}
                  tone={checklistTone}
                />
              </View>
              <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('readinessChecklistHint')}</Text>
            </View>
          </Card>

          {checklist.isLoading ? (
            <LoadingState label={t('loadingReadinessChecklist')} />
          ) : (
            <ListGroup>
              {TASKS.map((task, index) => {
                const done = checklist.data[task.id];
                return (
                  <ListRow
                    key={task.id}
                    isFirst={index === 0}
                    title={t(task.titleKey)}
                    subtitle={t(task.subtitleKey)}
                    value={done ? t('statusDone') : t('statusPending')}
                    onPress={() => void checklist.toggleTask(task.id)}
                  />
                );
              })}
            </ListGroup>
          )}
        </View>

        <Button
          kind="secondary"
          label={t('readinessResetChecklist')}
          onPress={() => void checklist.resetChecklist()}
          disabled={checklist.isSaving}
        />

        <View>
          <SectionHeader title={t('readinessPhaseRoadmapTitle')} />
          <ListGroup>
            <ListRow isFirst title={t('readinessRoadmapPhase1')} subtitle={phaseLabel(phase1)} />
            <ListRow title={t('readinessRoadmapPhase2')} subtitle={t('statusPending')} />
            <ListRow title={t('readinessRoadmapPhase3')} subtitle={t('statusPending')} />
            <ListRow title={t('readinessRoadmapPhase4')} subtitle={t('statusPending')} />
            <ListRow title={t('readinessRoadmapPhase5')} subtitle={t('statusPending')} />
            <ListRow title={t('readinessRoadmapPhase6')} subtitle={t('statusPending')} />
          </ListGroup>
        </View>

        <View>
          <SectionHeader title={t('readinessNextStepsTitle')} />
          <ListGroup>
            <ListRow isFirst title={t('readinessNext1')} />
            <ListRow title={t('readinessNext2')} />
            <ListRow title={t('readinessNext3')} />
          </ListGroup>
        </View>
      </Stack>
    </PageShell>
  );
}
