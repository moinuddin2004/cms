import * as SecureStore from 'expo-secure-store';

/**
 * The refresh token (`sessionId:token`) lives ONLY in the device keychain /
 * keystore. The access token is never persisted — it stays in memory
 * (`useAuthStore`) and is re-issued from this on app start.
 */
const REFRESH_TOKEN_KEY = 'auth.refreshToken';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, options);
  } catch {
    // Keychain unreadable (e.g. restored backup on a new device): sign in again.
    return null;
  }
}

export function setRefreshToken(value: string): Promise<void> {
  return SecureStore.setItemAsync(REFRESH_TOKEN_KEY, value, options);
}

export async function clearRefreshToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, options);
  } catch {
    // nothing stored
  }
}
