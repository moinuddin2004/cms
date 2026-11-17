import { isOnlineNow } from '@/core/network';
import { getExpoPushToken } from '@/core/notifications/push-token';
import { createSecureItem } from '@/core/storage/secure-store';

import { getRefreshToken } from '@/staff/lib/session';

import { registerDevice, unregisterDevice, unregisterDeviceWithoutSession } from '../api/devices.api';
import { buildDeviceRegistration } from './device-body';

/**
 * The token this install last registered for the staff account, kept in the keychain so sign-out can
 * delete it without asking Expo for a token again (that needs the network and a granted permission).
 */
const registeredToken = createSecureItem('staff.pushToken');

/**
 * Registers this phone for staff pushes. Safe to call on every start: the API upserts by token.
 * Returns whether a registration was sent; never throws (push is best effort).
 */
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
 * Stops pushes to this phone for the signed-in staff account. Call it BEFORE the session is dropped
 * (the API needs the access token). Best effort: an offline sign-out still proceeds, and the server
 * also moves the token to whoever registers it next and drops it when Expo reports it dead.
 */
export async function unregisterThisDevice(): Promise<void> {
  try {
    const token = await registeredToken.get();
    // Offline: skip (the call would only wait for its timeout); the token stays for a later sign-out.
    if (!token || !isOnlineNow()) return;
    await unregisterDevice(token);
    await registeredToken.clear();
  } catch {
    // keep the token so a later sign-out can retry
  }
}

/**
 * An offline sign-out keeps the token (above), and a forced sign-out (refresh rejected) cannot
 * unregister at all. On a later start with NO staff session the phone would keep receiving the old
 * account's pushes ("Ali · Token 12"), so finish the job through the session-less endpoint. Does
 * nothing while a session exists (signing in again moves the token to that account). Best effort,
 * never throws (audit M4).
 */
export async function finishPendingUnregister(): Promise<void> {
  try {
    const token = await registeredToken.get();
    if (!token || !isOnlineNow()) return;
    if ((await getRefreshToken()) !== null) return;
    await unregisterDeviceWithoutSession(token);
    await registeredToken.clear();
  } catch {
    // try again next start
  }
}
