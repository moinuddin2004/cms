import * as SecureStore from 'expo-secure-store';

/**
 * The device keychain / keystore wrapper. Only tokens and encryption keys go
 * here — never anything else. A space picks its own item key
 * (`staff/lib/session.ts` → `auth.refreshToken`).
 */
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export interface SecureItem {
  get: () => Promise<string | null>;
  set: (value: string) => Promise<void>;
  clear: () => Promise<void>;
}

/** One SecureStore value, readable only after the first unlock on this device. */
export function createSecureItem(key: string): SecureItem {
  return {
    get: async () => {
      try {
        return await SecureStore.getItemAsync(key, options);
      } catch {
        // Keychain unreadable (e.g. restored backup on a new device): treat as absent.
        return null;
      }
    },
    set: (value: string) => SecureStore.setItemAsync(key, value, options),
    clear: async () => {
      try {
        await SecureStore.deleteItemAsync(key, options);
      } catch {
        // nothing stored
      }
    },
  };
}
