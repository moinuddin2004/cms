import { create } from 'zustand';

import { getPref, removePref, setPref } from '@/core/storage/prefs';

/**
 * The two isolated halves of the app (docs/01 §2). `null` means no space has
 * been chosen yet: the welcome picker is showing.
 */
export type Space = 'staff' | 'patient';

function isSpace(value: string | undefined): value is Space {
  return value === 'staff' || value === 'patient';
}

/**
 * Read the last chosen space synchronously at module load so the root layout
 * renders the right group on the first frame (no splash flash, no redirect
 * through the welcome screen for a returning user).
 */
function readActiveSpace(): Space | null {
  const stored = getPref('space.active');
  return isSpace(stored) ? stored : null;
}

interface SpaceState {
  activeSpace: Space | null;
  setActiveSpace: (space: Space | null) => void;
}

/**
 * The only state shared by both spaces (docs/02 §3). Persisted in the plain
 * prefs MMKV — it is not secret (docs/03 §2.6).
 */
export const useSpaceStore = create<SpaceState>()((set) => ({
  activeSpace: readActiveSpace(),

  setActiveSpace: (space) => {
    if (space) setPref('space.active', space);
    else removePref('space.active');
    set({ activeSpace: space });
  },
}));
