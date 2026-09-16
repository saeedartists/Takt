import { useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  AnimatedProgressBar,
  Badge,
  Card,
  ListGroup,
  ListRow,
  PageHeader,
  PageShell,
  SectionHeader,
  Stack,
  spacing,
} from '@/components/ui';
import { useConsentAudit } from '@/lib/takt/consent-audit';
import { useIsolationMatrix } from '@/lib/takt/isolation-matrix';
import { useLocale } from '@/lib/takt/l10n';
import { useReadinessChecklist } from '@/lib/takt/readiness-checklist';
import { useReminderCertification } from '@/lib/takt/reminder-certification';
import { useReportReview } from '@/lib/takt/report-review';
import { useSessionTokenMatrix } from '@/lib/takt/session-token-matrix';

const statusTone = (done: boolean): 'success' | 'warning' => (done ? 'success' : 'warning');

export default function ReleaseHubScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const readiness = useReadinessChecklist();
  const reminder = useReminderCertification();
  const isolation = useIsolationMatrix();
  const report = useReportReview();
  const consent = useConsentAudit();
  const session = useSessionTokenMatrix();

  const authDone = readiness.data['auth-live-smoke'];
  const reminderDone = readiness.data['reminder-ios-closed'] && readiness.data['reminder-android-closed'];
  const timezoneDone = readiness.data['timezone-dst'];
  const reportDone = readiness.data['report-pdf-reviewed'];
  const consentDone = readiness.data['consent-audit'];
  const isolationDone = readiness.data['patient-isolation'];
  const sessionDone = readiness.data['session-token-qa'];
  const a11yDone = readiness.data['a11y-pass'];

  const releaseReady =
    authDone && reminderDone && timezoneDone && reportDone && consentDone && isolationDone && sessionDone && a11yDone;

  return (
    <PageShell>
      <PageHeader title={t('releaseHubTitle')} subtitle={t('releaseHubSubtitle')} />

      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(3) }}>
            <Badge
              tone={releaseReady ? 'success' : 'warning'}
              label={releaseReady ? t('releaseHubReady') : t('releaseHubNotReady')}
            />
            <AnimatedProgressBar
              progress={readiness.completionPct}
              tintColor={readiness.completionPct === 100 ? '#10B981' : undefined}
            />
            <Badge
              tone={readiness.completionPct === 100 ? 'success' : 'neutral'}
              label={t('releaseHubChecklistProgress').replace('{done}', readiness.done.toString()).replace('{total}', readiness.total.toString())}
            />
          </View>
        </Card>

        <View>
          <SectionHeader title={t('releaseHubCriticalGates')} />
          <ListGroup>
            <ListRow
              isFirst
              title={t('releaseHubAuth')}
              subtitle={t('releaseHubAuthHint')}
              trailing={<Badge tone={statusTone(authDone)} label={authDone ? t('statusDone') : t('statusPending')} />}
              onPress={() => router.push('/settings/readiness' as never)}
            />
            <ListRow
              title={t('releaseHubReminder')}
              subtitle={t('releaseHubReminderHint').replace('{done}', reminder.done.toString()).replace('{total}', reminder.total.toString())}
              trailing={<Badge tone={statusTone(reminderDone)} label={reminderDone ? t('statusDone') : t('statusPending')} />}
              onPress={() => router.push('/settings/reminder-certification' as never)}
            />
            <ListRow
              title={t('releaseHubTimezone')}
              subtitle={t('releaseHubTimezoneHint')}
              trailing={<Badge tone={statusTone(timezoneDone)} label={timezoneDone ? t('statusDone') : t('statusPending')} />}
              onPress={() => router.push('/settings/reminder-certification' as never)}
            />
            <ListRow
              title={t('releaseHubIsolation')}
              subtitle={t('releaseHubIsolationHint').replace('{done}', isolation.done.toString()).replace('{total}', isolation.total.toString())}
              trailing={<Badge tone={statusTone(isolationDone)} label={isolationDone ? t('statusDone') : t('statusPending')} />}
              onPress={() => router.push('/settings/isolation' as never)}
            />
            <ListRow
              title={t('releaseHubSession')}
              subtitle={t('releaseHubSessionHint').replace('{done}', session.done.toString()).replace('{total}', session.total.toString())}
              trailing={<Badge tone={statusTone(sessionDone)} label={sessionDone ? t('statusDone') : t('statusPending')} />}
              onPress={() => router.push('/settings/session-security' as never)}
            />
            <ListRow
              title={t('releaseHubConsent')}
              subtitle={t('releaseHubConsentHint').replace('{done}', consent.done.toString()).replace('{total}', consent.total.toString())}
              trailing={<Badge tone={statusTone(consentDone)} label={consentDone ? t('statusDone') : t('statusPending')} />}
              onPress={() => router.push('/settings/consent-audit' as never)}
            />
            <ListRow
              title={t('releaseHubReport')}
              subtitle={t('releaseHubReportHint').replace('{done}', report.done.toString()).replace('{total}', report.total.toString())}
              trailing={<Badge tone={statusTone(reportDone)} label={reportDone ? t('statusDone') : t('statusPending')} />}
              onPress={() => router.push('/settings/report-review' as never)}
            />
            <ListRow
              title={t('releaseHubA11y')}
              subtitle={t('releaseHubA11yHint')}
              trailing={<Badge tone={statusTone(a11yDone)} label={a11yDone ? t('statusDone') : t('statusPending')} />}
              onPress={() => router.push('/settings/accessibility-pass' as never)}
            />
          </ListGroup>
        </View>

        <View>
          <SectionHeader title={t('releaseHubNextActionTitle')} />
          <ListGroup>
            <ListRow
              isFirst
              title={t('releaseHubNextReminder')}
              trailing={<Badge tone={statusTone(releaseReady)} label={releaseReady ? t('statusDone') : t('statusPending')} />}
            />
            <ListRow
              title={t('releaseHubNextEvidence')}
              trailing={<Badge tone={statusTone(consentDone && reportDone && sessionDone)} label={consentDone && reportDone && sessionDone ? t('statusDone') : t('statusPending')} />}
            />
            <ListRow
              title={t('releaseHubNextSignoff')}
              trailing={<Badge tone={statusTone(releaseReady)} label={releaseReady ? t('statusDone') : t('statusPending')} />}
            />
          </ListGroup>
        </View>

        <Badge tone={statusTone(releaseReady)} label={releaseReady ? t('releaseHubGatePass') : t('releaseHubGateBlocked')} />
      </Stack>
    </PageShell>
  );
}
