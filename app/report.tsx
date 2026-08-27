import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
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
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';
import { buildReportSummary } from '@/lib/takt/report-summary';
import { buildHistory } from '@/lib/takt/schedule';

const esc = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const REPORT_MEDICATION_LIMIT = 20;
const REPORT_MISSED_LIMIT = 12;

export default function ReportScreen() {
  const { c } = useTokens();
  const { t, formatDate, formatDateTime } = useLocale();
  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const history = useMemo(
    () => buildHistory(plans.plans, (events.data?.entry ?? []).map((x) => x.resource), 14),
    [events.data?.entry, plans.plans],
  );

  const summary = useMemo(
    () =>
      buildReportSummary({
        plans: plans.plans,
        history,
        formatMissedDateTime: (value) =>
          formatDateTime(value, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
      }),
    [formatDateTime, history, plans.plans],
  );

  const exportPdf = async () => {
    if (!patient.data) return;

    setExportError(null);
    setExporting(true);

    try {
      const patientName = `${patient.data.name?.[0]?.given?.join(' ') ?? ''} ${
        patient.data.name?.[0]?.family ?? ''
      }`.trim();

      const visibleMeds = summary.byMedication.slice(0, REPORT_MEDICATION_LIMIT);
      const hiddenMeds = Math.max(0, summary.byMedication.length - visibleMeds.length);

      const visibleMissed = summary.missedRows.slice(0, REPORT_MISSED_LIMIT);
      const hiddenMissed = Math.max(0, summary.missedRows.length - visibleMissed.length);

      const medicationRows = visibleMeds
        .map((row) => `<tr><td>${esc(row.label)}</td><td style=\"text-align:right\">${row.pct}%</td></tr>`)
        .join('');

      const missedRows = visibleMissed
        .map((row) => `<tr><td>${esc(row.label)}</td><td style=\"text-align:right\">${esc(row.dateLabel)}</td></tr>`)
        .join('');

      const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 18px; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0E1218; }
      h1 { margin: 0 0 6px 0; font-size: 22px; }
      .meta { color: #5C646F; margin-bottom: 14px; font-size: 12px; line-height: 1.4; }
      .score { font-size: 30px; color: #B4611C; margin: 6px 0 14px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th, td { border-bottom: 1px solid #E8E6E3; padding: 5px 0; font-size: 12px; line-height: 1.3; }
      th { text-align: left; color: #5C646F; font-weight: 600; }
      .small { color: #5C646F; font-size: 11px; margin-top: 8px; line-height: 1.35; }
      .muted { color: #5C646F; font-size: 11px; margin: 2px 0 8px; }
    </style>
  </head>
  <body>
    <h1>${esc(t('reportPdfHeading'))}</h1>
    <div class="meta">${esc(t('patientLabel'))}: ${esc(patientName || 'N/A')}<br/>${esc(t('dateLabel'))}: ${esc(
        formatDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' }),
      )}<br/>${esc(t('windowLabel'))}: ${esc(t('adherenceWindow'))}</div>
    <div class="score">${summary.pct}% ${esc(t('takenOnSchedule'))}</div>

    <table>
      <thead><tr><th>${esc(t('medications'))}</th><th style="text-align:right">${esc(t('completion'))}</th></tr></thead>
      <tbody>${medicationRows}</tbody>
    </table>
    ${hiddenMeds > 0 ? `<div class=\"muted\">${esc(t('reportExtraMedications').replace('{count}', hiddenMeds.toString()))}</div>` : ''}

    <table>
      <thead><tr><th>${esc(t('missedDoses'))}</th><th style="text-align:right">${esc(t('dateLabel'))}</th></tr></thead>
      <tbody>${missedRows || `<tr><td colspan=\"2\">${esc(t('reportNoMissedInPeriod'))}</td></tr>`}</tbody>
    </table>
    ${hiddenMissed > 0 ? `<div class=\"muted\">${esc(t('reportExtraMissedRows').replace('{count}', hiddenMissed.toString()))}</div>` : ''}

    <div class="small">${esc(t('reportPdfDisclaimer'))}</div>
  </body>
</html>`;

      const file = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
      } else {
        setExportError(t('sharingUnavailable'));
      }
    } catch {
      setExportError(t('pdfError'));
    } finally {
      setExporting(false);
    }
  };

  if (patient.isLoading || plans.isLoading || events.isLoading) {
    return (
      <PageShell>
        <LoadingState label={t('preparingPdf')} />
      </PageShell>
    );
  }

  if (patient.error || plans.error || events.error) {
    return (
      <PageShell>
        <ErrorState
          description={t('loadReportError')}
          onRetry={() => {
            void patient.refetch();
            void plans.requestsQuery.refetch();
            void plans.medicationsQuery.refetch();
            void events.refetch();
          }}
        />
      </PageShell>
    );
  }

  if (!patient.data) {
    return (
      <PageShell>
        <EmptyState title={t('noPatientProfile')} description={t('noPatientProfileHint')} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title={t('reportTitle')} subtitle={t('reportWindow')} />
      <Stack>
        <Card>
          <View style={{ padding: spacing(4), gap: spacing(2.5) }}>
            <Text style={[typography.headline, { color: c.textPrimary }]}>{t('reportTitle')}</Text>
            <Text style={[typography.subhead, { color: c.textSecondary }]}> 
              {t('patientLabel')}: {patient.data.name?.[0]?.given?.join(' ') ?? ''} {patient.data.name?.[0]?.family ?? ''}
            </Text>
            <Text style={[typography.subhead, { color: c.textSecondary }]}>
              {t('dateLabel')}: {formatDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={[typography.title2, { color: c.textPrimary, marginTop: spacing(1) }]}>
              {summary.pct}% {t('takenOnSchedule')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' }}>
              <Badge label={`${summary.byMedication.length.toString()} ${t('medications')}`} tone="accent" />
              <Badge label={`${summary.missedRows.length.toString()} ${t('statusMissed')}`} tone="destructive" />
            </View>
            <Button
              label={exporting ? t('preparingPdf') : t('exportPdf')}
              onPress={() => void exportPdf()}
              disabled={exporting}
            />
            {exportError ? <Text style={[typography.footnote, { color: c.destructive }]}>{exportError}</Text> : null}
          </View>
        </Card>

        <View>
          <SectionHeader title={t('reportPerMedication')} />
          {summary.byMedication.length === 0 ? (
            <EmptyState title={t('noAdherenceHistory')} description={t('historyNeedsSchedule')} />
          ) : (
            <ListGroup>
              {summary.byMedication.map((row, index) => (
                <ListRow key={row.id} isFirst={index === 0} title={row.label} value={`${row.pct.toString()}%`} />
              ))}
            </ListGroup>
          )}
        </View>
      </Stack>
    </PageShell>
  );
}
