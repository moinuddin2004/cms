/**
 * Native Google sign-in adapter (A-20, card M1-17).
 *
 * The ONLY file that touches `@react-native-google-signin/google-signin`.
 * Everything else asks this adapter for a Google ID token and is tested with it mocked.
 *
 * The package is loaded lazily inside try/catch (Metro treats that `require` as an optional
 * dependency), so the app builds and runs before the package is installed: the adapter then
 * reports itself unavailable and the Google button stays hidden.
 */

type GoogleSigninModule = {
  GoogleSignin: {
    configure: (options: { webClientId: string; iosClientId?: string; scopes?: string[] }) => void;
    hasPlayServices: (options?: { showPlayServicesUpdateDialog?: boolean }) => Promise<boolean>;
    signIn: () => Promise<
      { type: 'success'; data: { idToken: string | null } } | { type: 'cancelled' }
    >;
    signOut: () => Promise<unknown>;
  };
};

function loadModule(): GoogleSigninModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-google-signin/google-signin') as GoogleSigninModule;
  } catch {
    return null;
  }
}

/** True when the native library is part of this build (false in Expo Go / before install). */
export function isNativeGoogleAvailable(): boolean {
  return loadModule() !== null;
}

/**
 * Show the native Google account picker and return a Google ID token, or null when the user
 * cancelled. `webClientId` is the server's OAuth web client id (`GET /auth/google/config`):
 * the token is minted for it, which the backend already accepts.
 *
 * Throws when the library is missing, Play Services is unavailable, or Google returns no token.
 */
export async function getGoogleIdToken(
  webClientId: string,
  iosClientId?: string,
): Promise<string | null> {
  const mod = loadModule();
  if (!mod) throw new Error('Google sign-in is not available in this build.');
  const { GoogleSignin } = mod;

  GoogleSignin.configure({
    webClientId,
    iosClientId: iosClientId || undefined,
  });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Always show the account chooser instead of silently reusing the last account.
  await GoogleSignin.signOut().catch(() => undefined);

  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') return null;
  if (!response.data.idToken) throw new Error('Google did not return an ID token.');
  return response.data.idToken;
}
