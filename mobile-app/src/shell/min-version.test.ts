import { parseMinVersion } from './min-version';

describe('parseMinVersion', () => {
  it('reads the wrapped response (ResponseWrapper)', () => {
    expect(
      parseMinVersion({
        data: { android: '1.2.0', ios: '1.2.1', message: 'Please update' },
        isSuccess: true,
        httpStatusCode: 200,
      }),
    ).toEqual({ android: '1.2.0', ios: '1.2.1', message: 'Please update' });
  });

  it('reads an unwrapped payload', () => {
    expect(parseMinVersion({ android: '1.0.0', ios: '1.0.0' })).toEqual({
      android: '1.0.0',
      ios: '1.0.0',
    });
  });

  it('drops an empty message', () => {
    expect(parseMinVersion({ data: { android: '1.0.0', ios: '1.0.0', message: '  ' } })).toEqual({
      android: '1.0.0',
      ios: '1.0.0',
    });
  });

  it('fails open on malformed or missing data', () => {
    expect(parseMinVersion(null)).toBeNull();
    expect(parseMinVersion('nope')).toBeNull();
    expect(parseMinVersion({ data: {} })).toBeNull();
    expect(parseMinVersion({ data: { android: 1, ios: '1.0.0' } })).toBeNull();
    expect(parseMinVersion({ data: { android: '1.0.0' } })).toBeNull();
  });
});
