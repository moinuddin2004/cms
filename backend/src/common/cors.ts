/**
 * Origins allowed to call the REST API and the `/realtime` gateway.
 *
 * `CORS_ORIGIN` is a comma-separated list; when it is unset the web app's
 * public URL (`FRONTEND_URL`, the same origin the e-mails link to) is used,
 * falling back to `http://localhost:3000` in development. The Tauri desktop
 * shell is always allowed on top of it: its Origin is set by the webview
 * itself (page JavaScript cannot forge it), and desktop sign-in depends on it.
 */

const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

const DEFAULT_TAURI_ORIGINS = [
  'http://tauri.localhost',
  'https://tauri.localhost',
  'tauri://localhost',
];

function envList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/** Origins the desktop shell can present (`TAURI_ORIGINS` overrides). */
export function tauriOrigins(): string[] {
  const configured = envList(process.env.TAURI_ORIGINS);
  return configured.length ? configured : DEFAULT_TAURI_ORIGINS;
}

/** Web app origin(s) + the desktop shell. */
export function allowedOrigins(): string[] {
  const configured = envList(process.env.CORS_ORIGIN);
  const web = configured.length
    ? configured
    : envList(process.env.FRONTEND_URL).slice(0, 1);
  const webOrigins = web.length ? web : [DEFAULT_WEB_ORIGIN];
  return [...new Set([...webOrigins, ...tauriOrigins()])];
}
