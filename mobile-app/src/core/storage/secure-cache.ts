import * as Crypto from 'expo-crypto';
import { createMMKV, deleteMMKV, type MMKV } from 'react-native-mmkv';

import { createSecureItem } from './secure-store';

/**
 * Per-space encrypted MMKV cache for allow-listed server data (docs/02 §9).
 * The random key is kept in SecureStore as `<space>.cacheKey`; wiping the
 * space deletes both the data file and the key (docs/03 §2.5).
 *
 * Uses react-native-mmkv v4 (Nitro) — `createMMKV` / `deleteMMKV`, not the
 * v3 `new MMKV()` constructor.
 */
export type CacheSpace = 'staff' | 'patient';

const CACHE_IDS: Record<CacheSpace, string> = {
  staff: 'staff-cache',
  patient: 'patient-cache',
};

/**
 * MMKV v4 uses AES-256 and rejects keys longer than 32 bytes. 32 random bytes
 * from expo-crypto base64-encode to 44 characters, so the stored key uses the
 * first 32 characters (192 bits of entropy) — the exact string MMKV receives.
 */
const CACHE_KEY_BYTES = 32;
const CACHE_KEY_LENGTH = 32;

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 (RFC 4648) for a byte array; keeps the key printable in SecureStore. */
function toBase64(bytes: Uint8Array): string {
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];

    encoded += BASE64_ALPHABET[first >> 2];
    encoded += BASE64_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    encoded +=
      second === undefined
        ? '='
        : BASE64_ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    encoded += third === undefined ? '=' : BASE64_ALPHABET[third & 0x3f];
  }
  return encoded;
}

function createCacheKey(): string {
  return toBase64(Crypto.getRandomBytes(CACHE_KEY_BYTES)).slice(
    0,
    CACHE_KEY_LENGTH,
  );
}

const cacheKeyItem = (space: CacheSpace) =>
  createSecureItem(`${space}.cacheKey`);

const openCaches = new Map<CacheSpace, MMKV>();
const openingCaches = new Map<CacheSpace, Promise<MMKV>>();

async function open(space: CacheSpace): Promise<MMKV> {
  const keyItem = cacheKeyItem(space);
  let key = await keyItem.get();
  if (!key) {
    key = createCacheKey();
    await keyItem.set(key);
  }

  const cache = createMMKV({
    id: CACHE_IDS[space],
    encryptionKey: key,
    encryptionType: 'AES-256',
  });
  openCaches.set(space, cache);
  return cache;
}

/**
 * Open one space's encrypted cache. The instance is reused for the app's
 * lifetime, and concurrent calls share a single open (so they cannot generate
 * two different keys).
 */
export function openSecureCache(space: CacheSpace): Promise<MMKV> {
  const opened = openCaches.get(space);
  if (opened) return Promise.resolve(opened);

  const opening = openingCaches.get(space);
  if (opening) return opening;

  const promise = open(space).finally(() => {
    openingCaches.delete(space);
  });
  openingCaches.set(space, promise);
  return promise;
}

/**
 * Wipe one space: all cached keys, the MMKV instance file and its SecureStore
 * key. The other space is untouched (docs/03 §2.5).
 */
export async function wipeSecureCache(space: CacheSpace): Promise<void> {
  const opening = openingCaches.get(space);
  if (opening) {
    // Let an in-flight open finish before deleting its file.
    await opening.catch(() => undefined);
  }

  openCaches.get(space)?.clearAll();
  openCaches.delete(space);
  deleteMMKV(CACHE_IDS[space]);
  await cacheKeyItem(space).clear();
}
