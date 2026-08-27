# Takt — Execution Plan From All Perspectives

Date: 2026-08-27

## 1) Product perspective
- Release-critical first: auth enablement + reminder reliability certification + legal closeout.
- Differentiator second: calm UX + trusted adherence math + one-page doctor report.
- Expansion third: snooze, dynamic schedule regeneration, family-sharing foundation.

## 2) Clinical safety perspective
- Never overstate adherence confidence.
- Keep formula transparent: `taken / (taken + skipped + missed)` with paused intervals excluded.
- Preserve correction audit metadata for clinician trust.

## 3) Design perspective (calm positioning)
- Replace urgent/fear wording with neutral guidance.
- Keep amber as primary action color, green for confirmed taken, red only in retrospective missed history.
- Maintain large readable type and non-color status cues.

## 4) Architecture perspective
- Current mobile preview is web-hosted; native bundle lane depends on EAS credentials.
- Background reminder certification requires native builds and real-device overnight tests.
- Keep schedule engine source-of-truth independent from notification-delivery success.

## 5) Data/FHIR perspective
- Continue using `Medication`, `MedicationRequest`, `MedicationAdministration`, `Consent`, `Patient`.
- Add explicit pause/archive intervals so denominator exclusions are deterministic.
- Keep event-level audit trail for corrections and report reproducibility.

## 6) QA perspective
- Hand-computed adherence fixtures for 1, 6, and 20 medication scenarios.
- Timezone + DST + app-killed + reboot matrix as release gate.
- Report parity test: PDF values must equal in-app history computation.

## 7) Security/compliance perspective
- Resolve tenant auth setting write blocker first.
- Finish privacy/imprint legal text and consent evidence package.
- Run session-token matrix and verify logout/revocation behavior.

## 8) Release operations perspective
- Gate A: auth settings writable + live sign-in/register smoke passes.
- Gate B: overnight reminder certification passes on both platforms.
- Gate C: one-page report generated for 1/6/20 meds with legal footer.

## Immediate next implementation order
1. Resolve backend settings write-path mismatch (`key-not-found`) and re-run auth smoke.
2. Build adherence fixture harness and edge-case assertions.
3. Complete calm microcopy + visual audit pass.
4. Lock report one-page rendering policy and export verification.
5. Add snooze + schedule-regeneration behaviors with audit-safe state transitions.
