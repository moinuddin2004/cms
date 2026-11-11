/** Actions that change server data are disabled while offline (card M1-06a). */
import { useOnline } from '@/core/network';

export function useCanMutate(): boolean {
  return useOnline();
}
