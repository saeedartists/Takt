import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  AnimatedNumber,
  AnimatedSegmentedControl,
  Button,
  Card,
  EmptyState,
  ErrorState,
  INK,
  ListGroup,
  ListRow,
  PageShell,
  ProgressRing,
  SectionHeader,
  SkeletonCard,
  Stack,
  Tile,
  font,
  motion,
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
import { describeCadence, describeInstruction } from '@/lib/takt/medication-form';
import { buildAsNeededLogForDay, buildHistory } from '@/lib/takt/schedule';

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

export default function ReportScreen() {
  const { c, isDark } = useTokens();
  const { t, formatDate, formatDateTime } = useLocale();
  const { enter, stagger } = useMotion();
  const insets = useSafeAreaInsets();
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

  const asNeededCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const resources = (events.data?.entry ?? []).map((x) => x.resource);
    for (const day of history) {
      for (const entry of buildAsNeededLogForDay(plans.plans, resources, day.date)) {
        counts[entry.plan.request.id] = (counts[entry.plan.request.id] ?? 0) + entry.doses.length;
      }
    }
    return counts;
  }, [events.data?.entry, history, plans.plans]);

  const medicationValue = (row: { pct: number; asNeeded?: boolean; asNeededCount?: number }): string =>
    row.asNeeded ? t('reportAsNeededDoses').replace('{count}', String(row.asNeededCount ?? 0)) : `${row.pct}%`;

  const summary = useMemo(
    () =>
      buildReportSummary({
        plans: plans.plans,
        history,
        asNeededCounts,
        formatMissedDateTime: (value) =>
          formatDateTime(value, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
      }),
    [asNeededCounts, formatDateTime, history, plans.plans],
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

  /** Share sheet on device; the browser's print dialog (Save as PDF) on web. */
  const deliverHtml = async (html: string) => {
    // expo-print's web build ignores `html` and prints the app screen, so print the report from a hidden frame.
    if (Platform.OS === 'web') {
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0' });
      document.body.appendChild(frame);
      const win = frame.contentWindow;
      if (!win) throw new Error('print frame unavailable');
      win.document.open();
      win.document.write(html);
      win.document.close();
      setNote({ tone: 'success', text: t('pdfWebPrintNote') });
      win.focus();
      win.print();
      setTimeout(() => frame.remove(), 60_000);
      return;
    }
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
      const active = plans.plans.filter((plan) => plan.request.status === 'active');
      const rows = active
        .map(
          (plan) =>
            `<tr><td>${esc(plan.label)}</td><td>${esc([plan.form, plan.strength].filter(Boolean).join(' · '))}</td><td>${esc([describeCadence(plan, t), describeInstruction(plan, t)].filter(Boolean).join(', '))}</td><td style="text-align:right">${esc(plan.times.join(', '))}</td></tr>`,
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

  /** The one-page clinical report. Content is fixed by the brief; only the screen around it is styled. */
  const reportHtml = (): string => {
    const medicationRows = visibleMeds
      .map((row) => `<tr><td>${esc(row.label)}</td><td style=\"text-align:right\">${esc(medicationValue(row))}</td></tr>`)
      .join('');

    const missedRows = visibleMissed
      .map((row) => `<tr><td>${esc(row.label)}</td><td style=\"text-align:right\">${esc(row.dateLabel)}</td></tr>`)
      .join('');

    const focusRows = focusNotes.map((note) => `<li>${esc(note)}</li>`).join('');

    return `
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
      .score { font-size: 24px; color: #15171C; margin: 4px 0 8px; font-weight: 700; }
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

  };

  const runExport = async (deliver: (html: string) => Promise<void>) => {
    if (!patient.data) return;
    setNote(null);
    setExporting(true);
    try {
      await deliver(reportHtml());
    } catch {
      setNote({ tone: 'error', text: t('pdfError') });
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = () => runExport(deliverHtml);
  // Straight to the system print dialog; the web build already prints from a hidden frame.
  const printReport = () =>
    runExport((html) => (Platform.OS === 'web' ? deliverHtml(html) : Print.printAsync({ html })));

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

  const sky = c.tones.sky;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <PageShell>
        <Stack>
          <View style={{ gap: spacing(4) }}>
            <Text accessibilityRole="header" style={[typography.largeTitle, { color: c.textPrimary }]}>
              {t('reportLead')}
            </Text>
            <AnimatedSegmentedControl
              track="surface"
              value={windowDays.toString()}
              onChange={(next) => setWindowDays(Number.parseInt(next, 10) as 7 | 14 | 30)}
              options={[
                { value: '7', label: t('historyWindow7') },
                { value: '14', label: t('historyWindow14') },
                { value: '30', label: t('historyWindow30') },
              ]}
            />
          </View>

          {/* The "paper": a preview of what the doctor gets. */}
          <Animated.View entering={enter(0)}>
            <Card style={[styles.paper, !isDark && styles.paperShadow]}>
              <View style={styles.wordmarkRow}>
                <Text style={[styles.wordmark, { color: c.textPrimary }]}>
                  takt<Text style={{ color: c.accent }}>.</Text>
                </Text>
                <Text numberOfLines={1} style={[typography.subhead, styles.flexText, { color: c.textSecondary, fontFamily: font.semibold }]}>
                  {t('reportTitle')}
                </Text>
              </View>

              <View style={styles.scoreRow}>
                <View accessible accessibilityRole="image" accessibilityLabel={`${summary.pct.toString()}% ${t('takenOnSchedule')}`}>
                  <ProgressRing progress={summary.pct / 100} size={96} stroke={12} color={c.success} track={c.surfaceRaised}>
                    <AnimatedNumber
                      value={summary.pct}
                      suffix="%"
                      delay={150}
                      style={[typography.title3, { color: c.textPrimary }]}
                    />
                  </ProgressRing>
                </View>
                <View style={styles.flexText}>
                  <Text style={[typography.headline, { color: c.textPrimary, fontFamily: font.bold }]}>
                    {t('reportDoseCount')
                      .replace('{taken}', summary.taken.toString())
                      .replace('{total}', summary.denominator.toString())}
                  </Text>
                </View>
              </View>

              <View style={[styles.meta, { borderTopColor: c.separator }]}>
                <Text style={[typography.subhead, { color: c.textSecondary }]}>
                  {t('patientLabel')}: {patientName}
                </Text>
                <Text style={[typography.subhead, { color: c.textSecondary }]}>
                  {t('dateLabel')}: {reportDate}
                </Text>
                <Text style={[typography.subhead, { color: c.textSecondary }]}>
                  {t('windowLabel')}: {windowText}
                </Text>
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={enter(1)}>
            <Tile tone="sky" style={styles.section}>
              <Text accessibilityRole="header" style={[typography.title3, { color: INK }]}>
                {t('reportVisitFocusTitle')}
              </Text>
              {focusNotes.map((focusNote) => (
                <View key={focusNote} style={styles.bullet}>
                  <View style={[styles.bulletDot, { backgroundColor: sky.fg }]} />
                  <Text style={[typography.callout, styles.flexText, { color: INK }]}>{focusNote}</Text>
                </View>
              ))}
            </Tile>
          </Animated.View>

          <Animated.View entering={enter(2)}>
            <Card style={styles.section}>
              <Text accessibilityRole="header" style={[typography.title3, { color: c.textPrimary }]}>
                {t('reportPerMedication')}
              </Text>
              {visibleMeds.length === 0 ? (
                <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('reportNoDataInWindow')}</Text>
              ) : (
                visibleMeds.map((row, index) => (
                  <MedicationBar
                    key={row.id}
                    label={row.label}
                    value={medicationValue(row)}
                    pct={row.asNeeded ? null : row.pct}
                    delay={stagger(index) + 200}
                  />
                ))
              )}
              {hiddenMeds > 0 ? (
                <Text style={[typography.footnote, { color: c.textTertiary }]}>
                  {t('reportExtraMedications').replace('{count}', hiddenMeds.toString())}
                </Text>
              ) : null}
            </Card>
          </Animated.View>

          <Animated.View entering={enter(3)}>
            <Card style={[styles.section, { gap: spacing(1) }]}>
              <Text accessibilityRole="header" style={[typography.title3, { color: c.textPrimary, marginBottom: spacing(2) }]}>
                {t('reportMissedDetailsTitle')}
              </Text>
              {visibleMissed.length === 0 ? (
                <Text style={[typography.subhead, { color: c.textSecondary }]}>{t('reportNoMissedInPeriod')}</Text>
              ) : (
                visibleMissed.map((row, index) => (
                  <View
                    key={`${row.requestId}-${row.scheduledAt.toISOString()}`}
                    style={[styles.missedRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}
                  >
                    <Text numberOfLines={1} style={[typography.callout, styles.flexText, { color: c.textPrimary, fontFamily: font.bold }]}>
                      {row.label}
                    </Text>
                    <Text style={[typography.subhead, { color: c.destructive, fontFamily: font.semibold, fontVariant: ['tabular-nums'] }]}>
                      {row.dateLabel}
                    </Text>
                  </View>
                ))
              )}
              {hiddenMissed > 0 ? (
                <Text style={[typography.footnote, { color: c.textTertiary }]}>
                  {t('reportExtraMissedRows').replace('{count}', hiddenMissed.toString())}
                </Text>
              ) : null}
            </Card>
          </Animated.View>

          <Animated.View entering={enter(4)}>
            <SectionHeader title={t('reportClinicianSummaryTitle')} />
            <ListGroup>
              <ListRow
                isFirst
                title={t('reportFactTotalLogged').replace('{count}', summary.denominator.toString())}
                subtitle={t('reportFactTotalLoggedHint')}
                leading={
                  <View style={[styles.factIcon, { backgroundColor: sky.bg }]}>
                    <Ionicons name="stats-chart-outline" size={18} color={sky.fg} />
                  </View>
                }
              />
              <ListRow
                title={t('reportFactMissed').replace('{count}', summary.missedRows.length.toString())}
                subtitle={t('reportFactMissedHint')}
                leading={
                  <View style={[styles.factIcon, { backgroundColor: c.tones.rose.bg }]}>
                    <Ionicons name="alert-circle-outline" size={18} color={c.tones.rose.fg} />
                  </View>
                }
              />
            </ListGroup>
          </Animated.View>

          <Animated.View entering={enter(5)} style={{ gap: spacing(3) }}>
            <Button
              kind="outline"
              label={t('exportMedicationListCta')}
              icon={<Ionicons name="list-outline" size={20} color={c.textPrimary} />}
              onPress={() => void exportMedicationList()}
              disabled={exporting}
            />
            <Text style={[typography.footnote, styles.footnote, { color: c.textTertiary }]}>
              {t('reportFormula')} {t('reportPdfDisclaimer')}
            </Text>
          </Animated.View>
        </Stack>
        {/* Room for the sticky action bar. */}
        <View style={{ height: 72 + insets.bottom }} />
      </PageShell>

      <View
        style={[
          styles.actionBar,
          { backgroundColor: c.background, borderTopColor: c.separator, paddingBottom: Math.max(insets.bottom, spacing(4)) },
        ]}
      >
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
        <View style={styles.actionRow}>
          <Button
            size="lg"
            label={t('exportPdf')}
            accentIcon="share-outline"
            onPress={() => void exportPdf()}
            loading={exporting}
            style={styles.flexText}
          />
          <Button
            kind="outline"
            size="lg"
            fullWidth={false}
            label={t('reportPrint')}
            onPress={() => void printReport()}
            disabled={exporting}
          />
        </View>
      </View>
    </View>
  );
}

/** One per-medication line: name and figure, with a bar that fills in (as-needed plans show a count, no bar). */
const MedicationBar = ({ label, value, pct, delay }: { label: string; value: string; pct: number | null; delay: number }) => {
  const { c } = useTokens();
  const { reduce } = useMotion();
  const target = Math.max(0, Math.min(100, pct ?? 0));
  const fill = useSharedValue(reduce ? target : 0);

  useEffect(() => {
    fill.value = reduce ? target : withDelay(delay, withSpring(target, motion.spring.settle));
  }, [delay, fill, reduce, target]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));

  return (
    <View style={{ gap: spacing(1.5) }}>
      <View style={styles.medHead}>
        <Text numberOfLines={1} style={[typography.callout, styles.flexText, { color: c.textPrimary, fontFamily: font.bold }]}>
          {label}
        </Text>
        <Text style={[typography.callout, { color: pct === null ? c.textSecondary : c.textPrimary, fontFamily: pct === null ? font.regular : font.bold, fontVariant: ['tabular-nums'] }]}>
          {value}
        </Text>
      </View>
      {pct === null ? null : (
        <View style={[styles.medTrack, { backgroundColor: c.surfaceRaised }]}>
          <Animated.View style={[styles.medFill, { backgroundColor: c.textPrimary }, fillStyle]} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  paper: { padding: spacing(5.5), gap: spacing(4) },
  paperShadow: {
    shadowColor: INK,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing(2) },
  wordmark: { fontFamily: font.displayHeavy, fontSize: 22, lineHeight: 26, letterSpacing: -0.6 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(4) },
  meta: { gap: spacing(0.5), paddingTop: spacing(3), borderTopWidth: StyleSheet.hairlineWidth },
  section: { padding: spacing(5), gap: spacing(3.5) },
  bullet: { flexDirection: 'row', gap: spacing(2.5) },
  bulletDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  flexText: { flex: 1, minWidth: 0 },
  medHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing(3) },
  medTrack: { height: 10, borderRadius: radius.full, overflow: 'hidden' },
  medFill: { height: '100%', borderRadius: radius.full },
  missedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(3),
    minHeight: 48,
  },
  factIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: { paddingHorizontal: spacing(1), lineHeight: 21 },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing(3),
    paddingHorizontal: spacing(5),
    gap: spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionRow: { flexDirection: 'row', gap: spacing(2.5), width: '100%', maxWidth: 640, alignSelf: 'center' },
});
