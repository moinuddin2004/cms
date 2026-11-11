import * as Application from 'expo-application';
import Constants from 'expo-constants';

/**
 * The build's store-facing version (docs/02 §11, X-03).
 *
 * `expo-application` reports the native version in a standalone/development
 * build; in Expo Go and on web there is no native version, so fall back to the
 * version in the app config. `0.0.0` means "unknown" and never gates the app.
 */
export const currentVersion: string =
  Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';

/** Numeric parts of a dotted version; missing parts are 0, suffixes are ignored. */
function parseVersion(version: string): [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = version
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);

  return [major, minor, patch];
}

/** Negative when `a` is older than `b`, positive when newer, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);

  for (let i = 0; i < 3; i += 1) {
    const diff = left[i] - right[i];
    if (diff !== 0) return diff;
  }

  return 0;
}

/**
 * True when this build is older than the server's minimum supported version.
 * An unknown current version (`0.0.0`) stays usable — the caller fails open.
 */
export function isBelow(minimum: string): boolean {
  return currentVersion !== '0.0.0' && compareVersions(currentVersion, minimum) < 0;
}
