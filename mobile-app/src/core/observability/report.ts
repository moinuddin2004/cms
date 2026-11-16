/**
 * Error reporting seam (DECISIONS A-24). Today: a PHI-safe `console.warn` in
 * development and a no-op in release. A provider (Sentry, …) plugs in later
 * through `setErrorReporter` — it only ever receives scrubbed data, so adding
 * one cannot leak a body, name, token or URL by mistake.
 */
import { log } from '../log';
import { scrubContext, scrubError, type ScrubbedContext, type ScrubbedError } from './scrub';

export interface ErrorReport {
  error: ScrubbedError;
  context: ScrubbedContext;
}

export type ErrorReporter = (report: ErrorReport) => void;

let reporter: ErrorReporter | null = null;

/** Installs the provider's sender (call once at start-up). `null` removes it. */
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

/**
 * Reports an unexpected error. Never throws. `context` accepts only the keys in
 * `CONTEXT_ALLOW_LIST`; everything else is dropped.
 */
export function reportError(err: unknown, context?: Record<string, unknown>): void {
  try {
    const report: ErrorReport = { error: scrubError(err), context: scrubContext(context) };
    if (reporter) reporter(report);
    else {
      // `log.warn` is dev-only and compiled out of release builds.
      const where = report.context.route ?? report.context.screen ?? report.context.source ?? '';
      log.warn(`[report] ${report.error.name} ${report.error.code ?? report.error.status ?? ''} ${where}`.trim());
    }
  } catch {
    // Reporting must never break the app.
  }
}
