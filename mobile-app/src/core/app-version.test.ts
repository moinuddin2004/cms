import { compareVersions, currentVersion, isBelow } from '@/core/app-version';

describe('compareVersions', () => {
  it('treats equal versions as equal', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
  });

  it('compares each numeric part, not the string', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('1.2.0', '1.1.9')).toBeGreaterThan(0);
    expect(compareVersions('2', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
  });

  it('ignores pre-release-style suffixes in the numeric parts', () => {
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(0);
  });
});

describe('isBelow', () => {
  it('reports the running build against a floor', () => {
    expect(isBelow('0.0.0')).toBe(false);
    expect(isBelow('999.0.0')).toBe(true);
  });

  it('exposes the native/app-config version, never undefined', () => {
    expect(typeof currentVersion).toBe('string');
    expect(currentVersion.length).toBeGreaterThan(0);
  });
});
