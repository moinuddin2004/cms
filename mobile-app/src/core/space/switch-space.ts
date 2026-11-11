import { useSpaceStore, type Space } from '@/core/space/useSpaceStore';

/**
 * Move between spaces without signing out of either (docs/02 §4): the root
 * guards react to `activeSpace`, the previous space's layout unmounts and its
 * session stays in memory + SecureStore.
 *
 * `null` goes back to the welcome picker (e.g. signing out of the last space).
 */
export function switchSpace(target: Space | null): void {
  useSpaceStore.getState().setActiveSpace(target);
}
