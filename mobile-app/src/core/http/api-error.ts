import axios from 'axios';

/** Axios error → the API's message (first one for validation arrays). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && !err.response) {
    return 'No connection. Check your internet and try again.';
  }
  const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(msg)) return String(msg[0]);
  return typeof msg === 'string' && msg ? msg : fallback;
}
