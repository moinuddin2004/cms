import { Global, Module } from '@nestjs/common';
import { storageProviderBinding } from './storage.config';
import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';

/**
 * File storage for the whole app (global): inject `StorageService`.
 * The provider is chosen in `storage.config.ts` — see the box there.
 */
@Global()
@Module({
  controllers: [UploadsController],
  providers: [storageProviderBinding, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
