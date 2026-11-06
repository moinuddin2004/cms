import { Provider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { CloudinaryStorageProvider } from './providers/cloudinary.provider';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from './storage-provider.interface';

/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ THE single place that decides where files go.                       │
 * │                                                                     │
 * │ `.env`:  STORAGE_DRIVER=cloudinary   (default)                      │
 * │                                                                     │
 * │ Adding another provider (S3, R2, GCS, local disk…):                 │
 * │  1. write `providers/<name>.provider.ts` implementing               │
 * │     `StorageProvider` (put / signedUrl / delete),                   │
 * │  2. add one line to STORAGE_DRIVERS below,                          │
 * │  3. set STORAGE_DRIVER=<name> + that provider's credentials.        │
 * │ Nothing else in the codebase changes: every upload, avatar, logo,   │
 * │ patient document, prescription PDF and lab attachment goes through  │
 * │ `StorageService` → this provider.                                   │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Files already stored keep the provider-specific key they were saved
 * with, so switching on a live system also needs the existing files copied
 * (or the old provider kept for reads).
 */
export const STORAGE_DRIVERS: Record<string, Type<StorageProvider>> = {
  cloudinary: CloudinaryStorageProvider,
  // s3: S3StorageProvider,
};

export const DEFAULT_STORAGE_DRIVER = 'cloudinary';

export const storageProviderBinding: Provider = {
  provide: STORAGE_PROVIDER,
  inject: [ConfigService, ModuleRef],
  useFactory: async (config: ConfigService, moduleRef: ModuleRef) => {
    const driver = (
      config.get<string>('STORAGE_DRIVER') || DEFAULT_STORAGE_DRIVER
    )
      .trim()
      .toLowerCase();
    const cls = STORAGE_DRIVERS[driver];
    if (!cls) {
      throw new Error(
        `Unknown STORAGE_DRIVER "${driver}". Known: ${Object.keys(STORAGE_DRIVERS).join(', ')}`,
      );
    }
    return moduleRef.create(cls);
  },
};
