import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { currentVersion } from '@/core/app-version';
import { isOnlineNow } from '@/core/network';
import { getExpoPushToken } from '@/core/notifications/push-token';
import { createSecureItem } from '@/core/storage/secure-store';

import {
  registerDevice,
  unregisterDevice,
  type PatientDeviceRegistration,
} from '../api/devices.api';

/**
 * The token this install last registered for the patient account, kept in the keychain so sign-out
 * can delete it without asking Expo again (that needs the network and a granted permission).
 */
const registeredToken = createSecureItem('patient.pushToken');

/** Request body for `POST /patient-api/devices`; `null` on a platform that has no push (web). */
export function buildDeviceRegistration(expoPushToken: string): PatientDeviceRegistration | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  const label = Device.modelName?.trim().slice(0, 80);
  return {
    expoPushToken,
    platform: Platform.OS,
    appVersion: currentVersion.slice(0, 20),
    ...(label ? { deviceLabel: label } : {}),
  };
}

/** Registers this phone for patient pushes. Safe on every start (upsert by token); never throws. */
export async function registerThisDevice(): Promise<boolean> {
  try {
    const token = await getExpoPushToken();
    if (!token) return false;
    const body = buildDeviceRegistration(token);
    if (!body) return false;
    await registerDevice(body);
    await registeredToken.set(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stops pushes to this phone for the signed-in patient account. Call it BEFORE the session is
 * dropped (the API needs the access token). Best effort with a short timeout: an offline sign-out
 * still proceeds, and the server also moves the token to whoever registers it next and drops it
 * when Expo reports it dead.
 */
export async function unregisterThisDevice(): Promise<void> {
  try {
    const token = await registeredToken.get();
    if (!token || !isOnlineNow()) return;
    await unregisterDevice(token);
    await registeredToken.clear();
  } catch {
    // keep the token so a later sign-out can retry
  }
}
