/**
 * The app's only logging entry point (docs/03 §2.7). A caller passes a short
 * message or an error name/code/route — never tokens, API responses or patient
 * data. `debug`/`warn` compile out of release builds; `error` carries only the
 * error's identity. Crash reporting itself is decided in M4-05.
 */

/**
 * Reports an unexpected error by name, with the API error code (if any) and the
 * route where it happened. Never pass the error object or a payload.
 */
function reportError(name: string, code?: string, route?: string): void {
  const context = [code, route].filter((part): part is string => Boolean(part)).join(' ');
  // The one allowed console call in the app: this file is the logging sink.
  console.error(`[mobile] ${name}${context ? ` ${context}` : ''}`);
}

export const log = {
  /** Development-only diagnostics; removed from release builds. */
  debug(message: string): void {
    if (__DEV__) console.log(message);
  },

  /** Development-only diagnostics; removed from release builds. */
  warn(message: string): void {
    if (__DEV__) console.warn(message);
  },

  /** An unexpected error, by name (+ optional API code and route). */
  error: reportError,
};
