import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { getExpoPushTokenAsync } from 'expo-notifications';

import { getPermissionState } from './permissions';

/** EAS project id from the app config (`extra.eas.projectId`); undefined in a bare local build. */
function projectId(): string | undefined {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEas = Constants.easConfig?.projectId;
  return typeof fromExtra === 'string' && fromExtra
    ? fromExtra
    : typeof fromEas === 'string' && fromEas
      ? fromEas
      : undefined;
}

/**
 * This install's Expo push token, or `null` when there cannot be one: simulator/emulator,
 * permission not granted, no EAS project id, or Expo unreachable. Never prompts and never throws.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if ((await getPermissionState()) !== 'granted') return null;
  const id = projectId();
  if (!id) return null;
  try {
    const { data } = await getExpoPushTokenAsync({ projectId: id });
    return data || null;
  } catch {
    return null;
  }
}
