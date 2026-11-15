import { maskTokens } from './HttpExceptionHandler';

describe('maskTokens', () => {
  const T = 'A'.repeat(43);

  it('masks claim tokens in the patient API (preview and accept)', () => {
    expect(maskTokens(`/patient-api/claims/${T}`)).toBe(
      '/patient-api/claims/***',
    );
    expect(maskTokens(`/patient-api/claims/${T}/accept?x=1`)).toBe(
      '/patient-api/claims/***/accept?x=1',
    );
  });

  it('masks landing-page tokens /c/<token> and /v/<token>', () => {
    expect(maskTokens(`/c/${T}`)).toBe('/c/***');
    expect(maskTokens(`/v/${T}?a=b`)).toBe('/v/***?a=b');
  });

  it('keeps the older token routes masked and leaves other paths alone', () => {
    expect(maskTokens(`/join/${T}`)).toBe('/join/***');
    expect(maskTokens('/patients/123/app-link')).toBe('/patients/123/app-link');
    expect(maskTokens('/api/c/keep')).toBe('/api/c/keep');
    expect(maskTokens(undefined)).toBeUndefined();
  });
});
