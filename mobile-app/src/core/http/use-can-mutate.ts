/** Actions that change server data are disabled while offline (card M1-06a) or on saved data (M1-06b). */
import { useOnline, useReadOnlyOffline } from '@/core/network';

export function useCanMutate(): boolean {
  const online = useOnline();
  const readOnly = useReadOnlyOffline();
  return online && !readOnly;
}
