import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedProgressBar,
  AnimatedSegmentedControl,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  PageShell,
  SectionHeader,
  SkeletonCard,
  Stack,
  radius,
  spacing,
  typography,
  useMotion,
  useTokens,
} from '@/components/ui';
import { useDoseEvents } from '@/lib/hooks/use-dose-events';
import { useMedicationPlans } from '@/lib/hooks/use-medication-plans';
import { usePrimaryPatient } from '@/lib/hooks/use-primary-patient';
import { useLocale } from '@/lib/takt/l10n';
import { useReminderPreferences } from '@/lib/takt/preferences';
import { buildReportSummary } from '@/lib/takt/report-summary';
import { buildHistory } from '@/lib/takt/schedule';

const esc = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

// One A4 page must hold 20 medications (definition of done, brief §13).
const REPORT_MEDICATION_LIMIT = 20;
const REPORT_MISSED_LIMIT = 6;

type Note = { tone: 'success' | 'error'; text: string };

/** Compact two-column line inside the paper sheet; hairline above all but the first. */
const PaperRow = ({ label, value, isFirst }: { label: string; value: string; isFirst: boolean }) => {
  const { c } = useTokens();
  return (
    <View style={[styles.paperRow, !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}>
      <Text numberOfLines={1} style={[typography.subhead, styles.paperRowLabel, { color: c.textPrimary }]}>
        {label}
      </Text>
      <Text style={[typography.subhead, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>{value}</Text>
    </View>
  );
};

export default function ReportScreen() {
  const { c, isDark } = useTokens();
  const { t, formatDate, formatDateTime } = useLocale();
  const { enter } = useMotion();
  const patient = usePrimaryPatient();
  const patientRef = patient.data ? `Patient/${patient.data.id}` : undefined;
  const plans = useMedicationPlans(patientRef);
  const events = useDoseEvents(patientRef);
  const [note, setNote] = useState<Note | null>(null);
  const [exporting, setExporting] = useState(false);
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(14);
  const prefs = useReminderPreferences();
  const graceHours = prefs.data?.graceHours;
  const windowText = t('adherenceWindowDays').replace('{days}', windowDays.toString());

  const history = useMemo(
    () => buildHistory(plans.plans, (events.data?.entry ?? []).map((x) => x.resource), windowDays, { graceHours }),
    [events.data?.entry, graceHours, plans.plans, windowDays],
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

  const recentMissed = summary.missedRows[0];

  const focusNotes = useMemo(() => {
    const notes = [
      t('reportFocusAdherence')
        .replace('{pct}', summary.pct.toString())
        .replace('{taken}', summary.taken.toString())
        .replace('{total}', summary.denominator.toString()),
    ];

    // Facts only (brief §7): no thresholds, no "needs review" verdicts on a clinical record.
    if (recentMissed) {
      notes.push(
        t('reportFocusMissedRecent').replace(
          '{when}',
          formatDateTime(recentMissed.scheduledAt, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        ),
      );
    } else {
      notes.push(t('reportFocusNoMissed'));
    }

    return notes;
  }, [formatDateTime, recentMissed, summary.denominator, summary.pct, summary.taken, t]);

  const patientName = `${patient.data?.name?.[0]?.given?.join(' ') ?? ''} ${
    patient.data?.name?.[0]?.family ?? ''
  }`.trim();
  const reportDate = formatDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' });
  const visibleMeds = summary.byMedication.slice(0, REPORT_MEDICATION_LIMIT);
  const hiddenMeds = Math.max(0, summary.byMedication.length - visibleMeds.length);
  const visibleMissed = summary.missedRows.slice(0, REPORT_MISSED_LIMIT);
  const hiddenMissed = Math.max(0, summary.missedRows.length - visibleMissed.length);
  // No traffic-light grading on the report (brief §7, §12).
  const pctColor = c.textPrimary;

  /** Share sheet on device; the browser's print dialog (Save as PDF) on web. */
  const deliverHtml = async (html: string) => {
    if (await Sharing.isAvailableAsync()) {
      const file = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
      setNote({ tone: 'success', text: t('pdfExportDone') });
    } else {
      setNote({ tone: 'success', text: t('pdfWebPrintNote') });
      await Print.printAsync({ html });
    }
  };

  /** One-page list of the current regimen for a pharmacy or a new doctor. The user's own plan, no drug data. */
  const exportMedicationList = async () => {
    if (!patient.data) return;
    setNote(null);
    setExporting(true);
    try {
      const cadenceLabel = (cadence: 'daily' | 'weekdays' | 'custom') =>
        cadence === 'weekdays' ? t('cadenceWeekdays') : cadence === 'custom' ? t('cadenceSpecificDays') : t('cadenceDaily');
      const active = plans.plans.filter((plan) => plan.request.status === 'active');
      const rows = active
        .map(
          (plan) =>
            `<tr><td>${esc(plan.label)}</td><td>${esc([plan.form, plan.strength].filter(Boolean).join(' · '))}</td><td>${esc(
              cadenceLabel(plan.cadence),
            )}</td><td style="text-align:right">${esc(plan.times.join(', '))}</td></tr>`,
        )
        .join('');
      const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 16px; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0E1218; }
      h1 { margin: 0 0 4px 0; font-size: 20px; }
      .meta { color: #5C646F; margin-bottom: 10px; font-size: 10px; line-height: 1.3; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #E8E6E3; padding: 4px 0; font-size: 11px; line-height: 1.3; text-align: left; }
      th { color: #5C646F; font-weight: 600; }
      .small { color: #5C646F; font-size: 9px; margin-top: 10px; line-height: 1.3; }
    </style>
  </head>
  <body>
    <h1>${esc(t('medicationListPdfHeading'))}</h1>
    <div class="meta">${esc(t('patientLabel'))}: ${esc(patientName || 'N/A')}<br/>${esc(t('dateLabel'))}: ${esc(reportDate)}</div>
    <table>
      <thead><tr><th>${esc(t('medicationName'))}</th><th>${esc(t('medicationForm'))} · ${esc(t('medicationStrength'))}</th><th>${esc(
        t('medicationCadence'),
      )}</th><th style="text-align:right">${esc(t('medicationTimes'))}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">${esc(t('medicationListEmpty'))}</td></tr>`}</tbody>
    </table>
    <div class="small">${esc(t('reportPdfDisclaimer'))}</div>
  </body>
</html>`;
      await deliverHtml(html);
    } catch {
      setNote({ tone: 'error', text: t('pdfError') });
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    if (!patient.data) return;

    setNote(null);
    setExporting(true);

    try {
      const medicationRows = visibleMeds
        .map((row) => `<tr><td>${esc(row.label)}</td><td style=\"text-align:right\">${row.pct}%</td></tr>`)
        .join('');

      const missedRows = visibleMissed
        .map((row) => `<tr><td>${esc(row.label)}</td><td style=\"text-align:right\">${esc(row.dateLabel)}</td></tr>`)
        .join('');

      const focusRows = focusNotes.map((note) => `<li>${esc(note)}</li>`).join('');

      const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 16px; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0E1218; }
      h1 { margin: 0 0 4px 0; font-size: 20px; }
      h2 { margin: 10px 0 4px 0; font-size: 13px; color: #0E1218; }
      .meta { color: #5C646F; margin-bottom: 8px; font-size: 10px; line-height: 1.3; }
      .score { font-size: 24px; color: #B4611C; margin: 4px 0 8px; font-weight: 700; }
      .notes { margin: 0 0 8px; padding-left: 16px; }
      .notes li { font-size: 10px; line-height: 1.3; margin: 0 0 3px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
      th, td { border-bottom: 1px solid #E8E6E3; padding: 3px 0; font-size: 10px; line-height: 1.3; }
      th { text-align: left; color: #5C646F; font-weight: 600; }
      .small { color: #5C646F; font-size: 9px; margin-top: 6px; line-height: 1.3; }
      .muted { color: #5C646F; font-size: 9px; margin: 1px 0 6px; line-height: 1.3; }
      .compact { page-break-inside: avoid; }
    </style>
  </head>
  <body>
    <h1>${esc(t('reportPdfHeading'))}</h1>
    <div class="meta">${esc(t('patientLabel'))}: ${esc(patientName || 'N/A')}<br/>${esc(t('dateLabel'))}: ${esc(
        reportDate,
      )}<br/>${esc(t('windowLabel'))}: ${esc(windowText)}</div>
    <div class="score">${summary.pct}% ${esc(t('takenOnSchedule'))}</div>

    <div class="compact">
      <h2>${esc(t('reportVisitFocusTitle'))}</h2>
      <ul class="notes">${focusRows}</ul>
    </div>

    <div class="compact">
      <h2>${esc(t('reportPerMedication'))}</h2>
      <table>
        <thead><tr><th>${esc(t('medications'))}</th><th style="text-align:right">${esc(t('completion'))}</th></tr></thead>
        <tbody>${medicationRows || `<tr><td colspan=\"2\">${esc(t('reportNoDataInWindow'))}</td></tr>`}</tbody>
      </table>
      ${hiddenMeds > 0 ? `<div class=\"muted\">${esc(t('reportExtraMedications').replace('{count}', hiddenMeds.toString()))}</div>` : ''}
    </div>

    <div class="compact">
      <h2>${esc(t('reportMissedDetailsTitle'))}</h2>
      <table>
        <thead><tr><th>${esc(t('missedDoses'))}</th><th style="text-align:right">${esc(t('dateLabel'))}</th></tr></thead>
        <tbody>${missedRows || `<tr><td colspan=\"2\">${esc(t('reportNoMissedInPeriod'))}</td></tr>`}</tbody>
      </table>
      ${hiddenMissed > 0 ? `<div class=\"muted\">${esc(t('reportExtraMissedRows').replace('{count}', hiddenMissed.toString()))}</div>` : ''}
    </div>

    <div class="small">${esc(t('reportPdfDisclaimer'))}</div>
  </body>
</html>`;

      await deliverHtml(html);
    } catch {
      setNote({ tone: 'error', text: t('pdfError') });
    } finally {
      setExporting(false);
    }
  };

  if (patient.isLoading || plans.isLoading || events.isLoading) {
    return (
      <PageShell>
          <SkeletonCard rows={4} />
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

  const paperStyle: ViewStyle = isDark ? styles.paper : { ...styles.paper, ...styles.paperShadow };

  return (
    <PageShell>
      <Stack>
        <View style={{ gap: spacing(2) }}>
          <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('reportWindowLabel')}</Text>
          <AnimatedSegmentedControl
            value={windowDays.toString()}
            onChange={(next) => setWindowDays(Number.parseInt(next, 10) as 7 | 14 | 30)}
            options={[
              { value: '7', label: t('historyWindow7') },
              { value: '14', label: t('historyWindow14') },
              { value: '30', label: t('historyWindow30') },
            ]}
          />
          <Button
            label={t('exportPdf')}
            icon={<Ionicons name="document-text-outline" size={18} color={c.surface} />}
            onPress={() => void exportPdf()}
            loading={exporting}
          />
          <Button
            kind="secondary"
            label={t('exportMedicationListCta')}
            icon={<Ionicons name="list-outline" size={18} color={c.textPrimary} />}
            onPress={() => void exportMedicationList()}
            disabled={exporting}
          />
          {exporting ? (
            <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('preparingPdf')}</Text>
          ) : note ? (
            <Text
              accessibilityRole={note.tone === 'error' ? 'alert' : undefined}
              style={[typography.footnote, { color: note.tone === 'error' ? c.destructive : c.textSecondary }]}
            >
              {note.text}
            </Text>
          ) : null}
        </View>

        <Animated.View entering={enter(0)}>
          <Card style={paperStyle}>
            <View style={styles.paperInner}>
              <View style={{ gap: spacing(1) }}>
                <Text style={[typography.title2, { color: c.textPrimary }]}>{t('reportPdfHeading')}</Text>
                <Text style={[typography.footnote, { color: c.textSecondary }]}>
                  {t('patientLabel')}: {patientName}
                </Text>
                <Text style={[typography.footnote, { color: c.textSecondary }]}>
                  {t('dateLabel')}: {reportDate}
                </Text>
                <Text style={[typography.footnote, { color: c.textSecondary }]}>
                  {t('windowLabel')}: {windowText}
                </Text>
              </View>

              <View style={{ gap: spacing(2) }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text
                    accessibilityLabel={`${summary.pct.toString()}% ${t('takenOnSchedule')}`}
                    style={[typography.metric, { color: pctColor, fontVariant: ['tabular-nums'] }]}
                  >
                    {summary.pct}%
                  </Text>
                  <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('takenOnSchedule')}</Text>
                </View>
                <AnimatedProgressBar progress={Math.min(1, Math.max(0, summary.pct / 100))} color={c.accent} height={8} />
              </View>

              <View style={[styles.paperSection, { borderTopColor: c.separator }]}>
                <Text style={[typography.headline, { color: c.textPrimary }]}>{t('reportVisitFocusTitle')}</Text>
                {focusNotes.map((focusNote) => (
                  <View key={focusNote} style={styles.bullet}>
                    <Text style={[typography.subhead, { color: c.accent }]}>•</Text>
                    <Text style={[typography.subhead, styles.bulletText, { color: c.textPrimary }]}>{focusNote}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.paperSection, { borderTopColor: c.separator }]}>
                <Text style={[typography.headline, { color: c.textPrimary }]}>{t('reportPerMedication')}</Text>
                {visibleMeds.length === 0 ? (
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('reportNoDataInWindow')}</Text>
                ) : (
                  <View>
                    {visibleMeds.map((row, index) => (
                      <PaperRow key={row.id} isFirst={index === 0} label={row.label} value={`${row.pct.toString()}%`} />
                    ))}
                  </View>
                )}
                {hiddenMeds > 0 ? (
                  <Text style={[typography.footnote, { color: c.textTertiary }]}>
                    {t('reportExtraMedications').replace('{count}', hiddenMeds.toString())}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.paperSection, { borderTopColor: c.separator }]}>
                <Text style={[typography.headline, { color: c.textPrimary }]}>{t('reportMissedDetailsTitle')}</Text>
                {visibleMissed.length === 0 ? (
                  <Text style={[typography.footnote, { color: c.textSecondary }]}>{t('reportNoMissedInPeriod')}</Text>
                ) : (
                  <View>
                    {visibleMissed.map((row, index) => (
                      <PaperRow
                        key={`${row.requestId}-${row.scheduledAt.toISOString()}`}
                        isFirst={index === 0}
                        label={row.label}
                        value={row.dateLabel}
                      />
                    ))}
                  </View>
                )}
                {hiddenMissed > 0 ? (
                  <Text style={[typography.footnote, { color: c.textTertiary }]}>
                    {t('reportExtraMissedRows').replace('{count}', hiddenMissed.toString())}
                  </Text>
                ) : null}
              </View>

              <Text style={[typography.caption, { color: c.textTertiary }]}>{t('reportPdfDisclaimer')}</Text>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <SectionHeader title={t('reportClinicianSummaryTitle')} />
          <ListGroup>
            <ListRow
              isFirst
              title={t('reportFactTotalLogged').replace('{count}', summary.denominator.toString())}
              subtitle={t('reportFactTotalLoggedHint')}
              leading={
                <View style={[styles.factIcon, { backgroundColor: `${c.accent}14` }]}>
                  <Ionicons name="stats-chart-outline" size={15} color={c.accent} />
                </View>
              }
            />
            <ListRow
              title={t('reportFactMissed').replace('{count}', summary.missedRows.length.toString())}
              subtitle={t('reportFactMissedHint')}
              leading={
                <View style={[styles.factIcon, { backgroundColor: `${c.destructive}1A` }]}>
                  <Ionicons name="alert-circle-outline" size={16} color={c.destructive} />
                </View>
              }
            />
          </ListGroup>
        </Animated.View>
      </Stack>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  paper: { borderRadius: radius.lg },
  paperShadow: {
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  paperInner: { padding: spacing(5), gap: spacing(4) },
  paperSection: {
    gap: spacing(2),
    paddingTop: spacing(4),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  paperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2),
  },
  paperRowLabel: { flex: 1, minWidth: 0 },
  bullet: { flexDirection: 'row', gap: spacing(2) },
  bulletText: { flex: 1, minWidth: 0 },
  factIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
