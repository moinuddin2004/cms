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

  it('accepts the desktop shell (Tauri Origin)', () => {
    const r = req({
      'x-client-type': 'desktop',
      'x-refresh-token': 's:t',
      origin: 'http://tauri.localhost',
    });
    expect(isNativeClient(r)).toBe(true);
    expect(nativeRefreshToken(r)).toBe('s:t');
  });

  it('accepts the desktop shell without an Origin header', () => {
    const r = req({ 'x-client-type': 'desktop', 'x-refresh-token': 's:t' });
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

  it('refuses a desktop request from a non-Tauri Origin', () => {
    const r = req({
      'x-client-type': 'desktop',
      'x-refresh-token': 's:t',
      origin: 'https://evil.example',
    });
    expect(isNativeClient(r)).toBe(false);
    expect(nativeRefreshToken(r)).toBeNull();
  });

  describe('tauri dev (webview loads the Vite dev server)', () => {
    const saved = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = saved;
    });

    it('accepts the dev server origin outside production', () => {
      process.env.NODE_ENV = 'development';
      const r = req({
        'x-client-type': 'desktop',
        'x-refresh-token': 's:t',
        origin: 'http://localhost:3000',
      });
      expect(isNativeClient(r)).toBe(true);
      expect(nativeRefreshToken(r)).toBe('s:t');
    });

    it('refuses the dev server origin in production', () => {
      process.env.NODE_ENV = 'production';
      const r = req({
        'x-client-type': 'desktop',
        'x-refresh-token': 's:t',
        origin: 'http://localhost:3000',
      });
      expect(isNativeClient(r)).toBe(false);
    });

    it('never lets a mobile client use it', () => {
      process.env.NODE_ENV = 'development';
      const r = req({
        'x-client-type': 'mobile',
        origin: 'http://localhost:3000',
      });
      expect(isNativeClient(r)).toBe(false);
    });
  });

  it('refuses a mobile request that carries a Tauri Origin', () => {
    const r = req({
      'x-client-type': 'mobile',
      'x-refresh-token': 's:t',
      origin: 'http://tauri.localhost',
    });
    expect(isNativeClient(r)).toBe(false);
    expect(nativeRefreshToken(r)).toBeNull();
  });

  it('ignores the header without the mobile client type', () => {
    expect(nativeRefreshToken(req({ 'x-refresh-token': 's:t' }))).toBeNull();
  });
});
