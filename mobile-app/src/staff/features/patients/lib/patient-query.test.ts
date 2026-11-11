import { patientQueryParams } from './patient-query';

describe('patientQueryParams', () => {
  it('keeps true flags and other params', () => {
    expect(patientQueryParams({ page: 2, search: 'ali', isMinor: true, isBlacklisted: true })).toEqual({
      page: 2,
      search: 'ali',
      isMinor: true,
      isBlacklisted: true,
    });
  });

  it('never sends false or undefined flags', () => {
    const bad = { isMinor: false, isBlacklisted: undefined, page: 1 } as unknown as Parameters<
      typeof patientQueryParams
    >[0];
    const out = patientQueryParams(bad);
    expect(out).toEqual({ page: 1 });
    expect('isMinor' in out).toBe(false);
    expect('isBlacklisted' in out).toBe(false);
  });
});
