import type { Request } from 'express';
import { tauriOrigins } from '../common/cors';

/**
 * Native clients can't rely on the httpOnly refresh cookie, so they get the
 * same `sessionId:refreshToken` value in the response body and send it back in
 * a header, keeping it in the device's secure storage.
 *
 * Only for requests that announce themselves as a native app AND either carry
 * no `Origin` header (mobile, which talks to the API directly) or carry a
 * Tauri origin (desktop, whose webview sets that header itself — a script in
 * a web page can never forge it). This is what stops a browser page from
 * reading the refresh token out of a response.
 */
export const CLIENT_TYPE_HEADER = 'x-client-type';
export const REFRESH_TOKEN_HEADER = 'x-refresh-token';

const NATIVE_CLIENT_TYPES = new Set(['mobile', 'desktop']);

export function isNativeClient(req: Request): boolean {
  const type = req.headers[CLIENT_TYPE_HEADER];
  if (typeof type !== 'string' || !NATIVE_CLIENT_TYPES.has(type)) return false;

  const origin = req.headers.origin;
  // A native app talks to the API itself: no Origin header at all.
  if (!origin) return true;
  // The desktop shell is a webview: it sends a Tauri origin.
  return type === 'desktop' && tauriOrigins().includes(origin);
}

/** The refresh header value, for native clients only. */
export function nativeRefreshToken(req: Request): string | null {
  if (!isNativeClient(req)) return null;
  const value = req.headers[REFRESH_TOKEN_HEADER];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
