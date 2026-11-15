import { useSyncExternalStore } from 'react';

/**
 * "Open on saved data" flag (M1-06b). The staff auth store sets it; core only reads it,
 * so `useCanMutate` can turn actions off without importing a space.
 */
let readOnly = false;
const listeners = new Set<() => void>();

export function setReadOnlyOffline(value: boolean): void {
  if (readOnly === value) return;
  readOnly = value;
  listeners.forEach((l) => l());
}

export const isReadOnlyOffline = () => readOnly;

export function useReadOnlyOffline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => readOnly,
    () => readOnly,
  );
}
