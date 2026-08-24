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
import { type ReminderCaseId, useReminderCertification } from '@/lib/takt/reminder-certification';
import { useLocale } from '@/lib/takt/l10n';

const CASES: Array<{
  id: ReminderCaseId;
  titleKey:
    | 'reminderCaseA1Title'
    | 'reminderCaseA2Title'
    | 'reminderCaseB1Title'
    | 'reminderCaseB2Title'
    | 'reminderCaseC1Title'
    | 'reminderCaseC2Title'
    | 'reminderCaseD1Title'
    | 'reminderCaseD2Title'
    | 'reminderCaseD3Title'
    | 'reminderCaseE1Title';
  subtitleKey:
    | 'reminderCaseA1Subtitle'
    | 'reminderCaseA2Subtitle'
    | 'reminderCaseB1Subtitle'
    | 'reminderCaseB2Subtitle'
    | 'reminderCaseC1Subtitle'
    | 'reminderCaseC2Subtitle'
    | 'reminderCaseD1Subtitle'
    | 'reminderCaseD2Subtitle'
    | 'reminderCaseD3Subtitle'
    | 'reminderCaseE1Subtitle';
}> = [
  { id: 'a1-ios-overnight', titleKey: 'reminderCaseA1Title', subtitleKey: 'reminderCaseA1Subtitle' },
  { id: 'a2-android-overnight', titleKey: 'reminderCaseA2Title', subtitleKey: 'reminderCaseA2Subtitle' },
  { id: 'b1-ios-reboot', titleKey: 'reminderCaseB1Title', subtitleKey: 'reminderCaseB1Subtitle' },
  { id: 'b2-android-reboot', titleKey: 'reminderCaseB2Title', subtitleKey: 'reminderCaseB2Subtitle' },
  { id: 'c1-timezone-shift', titleKey: 'reminderCaseC1Title', subtitleKey: 'reminderCaseC1Subtitle' },
  { id: 'c2-dst-alignment', titleKey: 'reminderCaseC2Title', subtitleKey: 'reminderCaseC2Subtitle' },
  { id: 'd1-edit-reconciliation', titleKey: 'reminderCaseD1Title', subtitleKey: 'reminderCaseD1Subtitle' },
  { id: 'd2-pause-reconciliation', titleKey: 'reminderCaseD2Title', subtitleKey: 'reminderCaseD2Subtitle' },
  { id: 'd3-archive-reconciliation', titleKey: 'reminderCaseD3Title', subtitleKey: 'reminderCaseD3Subtitle' },
  { id: 'e1-snooze-reliability', titleKey: 'reminderCaseE1Title', subtitleKey: 'reminderCaseE1Subtitle' },
];

export default function ReminderCertificationScreen() {
  const { c } = useTokens();
  const { t } = useLocale();
  const checklist = useReadinessChecklist();
  const cert = useReminderCertification();

  useEffect(() => {
    if (checklist.isLoading) return;

    if (checklist.data['reminder-ios-closed'] !== cert.iosOvernightPass) {
      void checklist.setTaskStatus('reminder-ios-closed', cert.iosOvernightPass);
    }

    if (checklist.data['reminder-android-closed'] !== cert.androidOvernightPass) {
      void checklist.setTaskStatus('reminder-android-closed', cert.androidOvernightPass);
    }

    if (checklist.data['timezone-dst'] !== cert.timezoneDstPass) {
      void checklist.setTaskStatus('timezone-dst', cert.timezoneDstPass);
    }
  }, [
    cert.androidOvernightPass,
    cert.iosOvernightPass,
    cert.timezoneDstPass,
    checklist.data,
    checklist.isLoading,
    checklist.setTaskStatus,
  ]);

  return (
    <PageShell>
      <PageHeader title={t('reminderCertTitle')} subtitle={t('reminderCertSubtitle')} />

      <Stack>
        <View>
          <SectionHeader title={t('reminderCertProgressTitle')} />
          <ListGroup>
            <ListRow
              isFirst
              title={t('reminderCertCaseProgress')}
              value={`${cert.done.toString()}/${cert.total.toString()} · ${cert.completionPct.toString()}%`}
            />
            <ListRow
              title={t('reminderCertReadinessSync')}
              subtitle={t('reminderCertReadinessSyncSubtitle')}
              value={
                cert.iosOvernightPass && cert.androidOvernightPass && cert.timezoneDstPass
                  ? t('statusDone')
                  : t('statusPending')
              }
            />
            <ListRow
              title={t('reminderCertEvidence')}
              value={cert.isEvidenceComplete ? t('statusDone') : t('statusPending')}
            />
          </ListGroup>
        </View>

        {cert.isLoading ? (
          <LoadingState label={t('loadingReminderCertification')} />
        ) : (
          <View>
            <SectionHeader title={t('reminderCertCasesTitle')} />
            <ListGroup>
              {CASES.map((item, index) => (
                <ListRow
                  key={item.id}
                  isFirst={index === 0}
                  title={t(item.titleKey)}
                  subtitle={t(item.subtitleKey)}
                  value={cert.data.cases[item.id] ? t('statusDone') : t('statusPending')}
                  onPress={() => void cert.toggleCase(item.id)}
                />
              ))}
            </ListGroup>
          </View>
        )}

        <View>
          <SectionHeader title={t('reminderCertEvidenceTitle')} />
          <View style={{ gap: spacing(3) }}>
            <Field label={t('reminderCertTesterName')}>
              <Input
                value={cert.data.testerName}
                onChangeText={(value) => void cert.updateMeta({ testerName: value })}
                placeholder={t('reminderCertTesterPlaceholder')}
                autoCapitalize="words"
              />
            </Field>

            <Field label={t('reminderCertRunDate')}>
              <Input
                value={cert.data.runDate}
                onChangeText={(value) => void cert.updateMeta({ runDate: value })}
                placeholder={t('reminderCertRunDatePlaceholder')}
              />
            </Field>

            <Field label={t('reminderCertDeviceSummary')}>
              <Input
                value={cert.data.deviceSummary}
                onChangeText={(value) => void cert.updateMeta({ deviceSummary: value })}
                placeholder={t('reminderCertDevicePlaceholder')}
              />
            </Field>

            <Field label={t('reminderCertAppVersion')}>
              <Input
                value={cert.data.appVersion}
                onChangeText={(value) => void cert.updateMeta({ appVersion: value })}
                placeholder={t('reminderCertAppVersionPlaceholder')}
              />
            </Field>

            <Field label={t('reminderCertNotes')}>
              <Input
                value={cert.data.notes}
                onChangeText={(value) => void cert.updateMeta({ notes: value })}
                placeholder={t('reminderCertNotesPlaceholder')}
                multiline
                textAlignVertical="top"
              />
            </Field>

            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('reminderCertEvidenceHint')}</Text>
          </View>
        </View>

        <View>
          <SectionHeader title={t('reminderCertBlockersTitle')} />
          <Badge
            tone={cert.iosOvernightPass && cert.androidOvernightPass && cert.timezoneDstPass ? 'success' : 'warning'}
            label={
              cert.iosOvernightPass && cert.androidOvernightPass && cert.timezoneDstPass
                ? t('reminderCertNoCriticalBlockers')
                : t('reminderCertCriticalBlockers')
            }
          />
        </View>

        <Button
          kind="secondary"
          label={t('reminderCertReset')}
          onPress={() => void cert.reset()}
          disabled={cert.isSaving || cert.isLoading}
        />
      </Stack>
    </PageShell>
  );
}
