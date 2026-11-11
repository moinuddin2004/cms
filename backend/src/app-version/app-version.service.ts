import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Payload of `GET /app/min-version` (07 §4.3). */
export interface AppMinVersion {
  android: string;
  ios: string;
  /** Optional line shown on the mobile "update required" screen. */
  message?: string;
}

/** No floor configured = every build may run. */
const DEFAULT_VERSION = '0.0.0';

@Injectable()
export class AppVersionService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Version floor for the mobile app, per platform. Read from env on each call
   * so raising the floor on a running API needs no code change.
   */
  getMinVersion(): AppMinVersion {
    const android = this.version('MOBILE_MIN_VERSION_ANDROID');
    const ios = this.version('MOBILE_MIN_VERSION_IOS');
    const message =
      this.config.get<string>('MOBILE_MIN_VERSION_MESSAGE')?.trim() ||
      undefined;

    return message ? { android, ios, message } : { android, ios };
  }

  private version(key: string): string {
    return this.config.get<string>(key)?.trim() || DEFAULT_VERSION;
  }
}
