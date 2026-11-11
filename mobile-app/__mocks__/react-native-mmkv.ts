/**
 * Jest manual mock for `react-native-mmkv` (card M0-06, docs/09 §2).
 *
 * v4 ships its own test mock (`createMockMMKV`) and swaps it in automatically
 * when `JEST_WORKER_ID` is set. That auto-detection never runs under Jest here
 * because importing the package eagerly loads the Nitro ESM runtime
 * (`nitro-core`), which Jest cannot `require`. This manual mock exposes the
 * library's own mock instead of reimplementing MMKV by hand, and keeps the v4
 * API the app uses: `createMMKV`, `deleteMMKV`, `existsMMKV`.
 *
 * Instances are shared per id (as on device) and `deleteMMKV` removes the
 * instance, so a wipe is observable: the next `createMMKV` starts empty.
 */
import { createMockMMKV } from 'react-native-mmkv/lib/createMMKV/createMockMMKV';
import type { Configuration, MMKV } from 'react-native-mmkv';

const instances = new Map<string, MMKV>();

export function createMMKV(configuration?: Configuration): MMKV {
  const id = configuration?.id ?? 'mmkv.default';
  const existing = instances.get(id);
  if (existing) return existing;

  const instance = createMockMMKV(configuration ?? { id });
  instances.set(id, instance);
  return instance;
}

export function deleteMMKV(id: string): boolean {
  return instances.delete(id);
}

export function existsMMKV(id: string): boolean {
  return instances.has(id);
}
