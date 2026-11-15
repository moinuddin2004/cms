import axios from 'axios';

/** Code of the local refusal of a write while the app is open on saved data (M1-06b). */
export const READ_ONLY_OFFLINE = 'READ_ONLY_OFFLINE';

/** Axios error → the API's message (first one for validation arrays). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.code === READ_ONLY_OFFLINE) return 'Saved data is read-only.';
  if (axios.isAxiosError(err) && !err.response) {
    return 'No connection. Check your internet and try again.';
  }
  const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(msg)) return String(msg[0]);
  return typeof msg === 'string' && msg ? msg : fallback;
}
