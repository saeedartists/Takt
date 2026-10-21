/*
 * error-reporting — single seam for crash/ErrorBoundary reporting.
 *
 * Default sink is a no-op with console capture in dev only, so production
 * builds stay silent until a provider (e.g. Sentry) is wired in. Call
 * `setErrorReporter` once at startup from a provider bootstrap to forward
 * events to a real backend.
 */

export type ErrorReport = {
  /** Where the error surfaced: 'boundary' for a React render crash. */
  source: 'boundary' | 'global';
  error: Error;
  /** React component stack, when the reporter is called from an ErrorBoundary. */
  componentStack?: string;
  /** Best-effort ISO timestamp of capture. */
  at: string;
};

export type ErrorReporter = (report: ErrorReport) => void;

let reporter: ErrorReporter = (report) => {
  if (__DEV__) {
    console.error(`[error-reporting:${report.source}]`, report.error, report.componentStack ?? '');
  }
};

/** Install a real reporter (e.g. one that forwards to Sentry); returns the previous one. */
export const setErrorReporter = (next: ErrorReporter): ErrorReporter => {
  const previous = reporter;
  reporter = next;
  return previous;
};

export const captureError = (
  source: ErrorReport['source'],
  error: Error,
  componentStack?: string,
): void => {
  try {
    reporter({ source, error, componentStack, at: new Date().toISOString() });
  } catch {
    // A broken reporter must never crash the app on top of an existing error.
  }
};
