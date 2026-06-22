import { Module } from '@nestjs/common';
import { AppLogger } from '../services/logger.service';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider';
import { UploadsController } from './uploads.controller';
import { STORAGE_PROVIDER } from './storage-provider.interface';

/**
 * Storage module — binds the active {@link StorageProvider} implementation.
 *
 * To swap providers later (e.g. S3), implement `StorageProvider` in a new class
 * and change ONLY the `useClass` below. No other code references Cloudinary.
 *
 * Relies on the globally-imported `CloudinaryModule` to have initialised the
 * Cloudinary SDK config.
 */
@Module({
  controllers: [UploadsController],
  providers: [
    AppLogger,
    CloudinaryStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useClass: CloudinaryStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
