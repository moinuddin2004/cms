import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications';

/**
 * Where the OS notification permission stands for this app:
 * - `undetermined`: never asked (iOS) or asked-and-can-ask-again (Android before the first prompt)
 * - `denied`: the user said no (the OS may not show the prompt again)
 */
export type PermissionState = 'granted' | 'undetermined' | 'denied';

interface PermissionLike {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

/** Pure mapping, tested on its own. */
export function toPermissionState(p: PermissionLike): PermissionState {
  if (p.granted) return 'granted';
  if (p.status === 'undetermined') return 'undetermined';
  return 'denied';
}

/** Reads the permission without ever prompting. */
export async function getPermissionState(): Promise<PermissionState> {
  try {
    return toPermissionState(await getPermissionsAsync());
  } catch {
    return 'denied';
  }
}

/**
 * Shows the OS prompt. Call it only from a deliberate moment (after our own explanation
 * sheet) — never at launch (docs/02 §8).
 */
export async function requestPermission(): Promise<PermissionState> {
  try {
    return toPermissionState(await requestPermissionsAsync());
  } catch {
    return 'denied';
  }
}
