import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * In development the API runs on the same machine as the Expo dev server, so
 * use that machine's LAN address (works on a real phone and on emulators).
 */
function devApiUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:5000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
}

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (__DEV__) return devApiUrl();
  // A release build without an API URL is a broken build — fail loudly.
  throw new Error('EXPO_PUBLIC_API_URL is not set for this build');
}

/**
 * The web app's origin, for public pages the app links to (privacy policy,
 * terms, account deletion — docs/legal). `EXPO_PUBLIC_WEB_URL` per build; in
 * development the web dev server on the same machine (port 3000). `null` in a
 * release build without it: callers hide the links instead of opening a
 * wrong host.
 */
function resolveWebUrl(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (__DEV__) {
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host) return `http://${host}:3000`;
    return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  }
  return null;
}

export const env = {
  apiUrl: resolveApiUrl(),
  webUrl: resolveWebUrl(),
  /** iOS OAuth client id for native Google sign-in (public value); empty on Android-only builds. */
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '',
} as const;
