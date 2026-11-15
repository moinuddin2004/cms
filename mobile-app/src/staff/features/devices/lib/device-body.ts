import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { currentVersion } from '@/core/app-version';

import type { DeviceRegistration } from '../api/devices.api';

/** Request body for `POST /me/devices`; `null` on a platform that has no push (web). */
export function buildDeviceRegistration(expoPushToken: string): DeviceRegistration | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  const label = Device.modelName?.trim().slice(0, 80);
  return {
    expoPushToken,
    platform: Platform.OS,
    appVersion: currentVersion.slice(0, 20),
    ...(label ? { deviceLabel: label } : {}),
  };
}
