import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { DevicePlatform } from '../entities/user-device.entity';

/** Trims strings; blank becomes null so an optional field can be cleared. */
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

/** `POST /me/devices` (07 §4.2). */
export class RegisterDeviceDto {
  /** Expo push token from `expo-notifications` (M1-05). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  expoPushToken: string;

  @IsIn(['android', 'ios'])
  platform: DevicePlatform;

  /** Human label ("Dr A's Pixel"), only for the device list. */
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(80)
  deviceLabel?: string | null;

  /** App build that registered the token, e.g. `1.2.0`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  appVersion: string;
}

/** `DELETE /me/devices` (07 §4.2). */
export class UnregisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  expoPushToken: string;
}
