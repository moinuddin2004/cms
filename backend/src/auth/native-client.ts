import type { Request } from 'express';

/**
 * Native (mobile) clients can't rely on the httpOnly refresh cookie, so they
 * get the same `sessionId:refreshToken` value in the response body and send
 * it back in a header, keeping it in the device's secure storage.
 *
 * Only for requests that announce themselves as the mobile app AND carry no
 * `Origin` header — browsers always send Origin on these POSTs, so a script
 * running in a web page can never use this to read the refresh token.
 */
export const CLIENT_TYPE_HEADER = 'x-client-type';
export const REFRESH_TOKEN_HEADER = 'x-refresh-token';

export function isNativeClient(req: Request): boolean {
  return req.headers[CLIENT_TYPE_HEADER] === 'mobile' && !req.headers.origin;
}

/** The refresh header value, for native clients only. */
export function nativeRefreshToken(req: Request): string | null {
  if (!isNativeClient(req)) return null;
  const value = req.headers[REFRESH_TOKEN_HEADER];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
