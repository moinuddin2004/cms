import type { Request } from 'express';
import { isNativeClient, nativeRefreshToken } from './native-client';

const req = (headers: Record<string, string>) =>
  ({ headers }) as unknown as Request;

describe('native client refresh token', () => {
  it('accepts the mobile app (no Origin)', () => {
    const r = req({ 'x-client-type': 'mobile', 'x-refresh-token': 's:t' });
    expect(isNativeClient(r)).toBe(true);
    expect(nativeRefreshToken(r)).toBe('s:t');
  });

  it('refuses any request from a browser page (has Origin)', () => {
    const r = req({
      'x-client-type': 'mobile',
      'x-refresh-token': 's:t',
      origin: 'https://evil.example',
    });
    expect(isNativeClient(r)).toBe(false);
    expect(nativeRefreshToken(r)).toBeNull();
  });

  it('ignores the header without the mobile client type', () => {
    expect(nativeRefreshToken(req({ 'x-refresh-token': 's:t' }))).toBeNull();
  });
});
