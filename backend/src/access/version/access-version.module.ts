import { Global, Module } from '@nestjs/common';
import { AccessChangeBus } from './access-change-bus';
import { AccessVersionService } from './access-version.service';
import { AccessVersionSubscriber } from './access-version.subscriber';

/**
 * `access_version` bookkeeping + the cross-process change bus. Global and
 * dependency-free (only the DataSource and Redis) so low-level modules such
 * as feature flags can listen without importing AccessModule (which itself
 * depends on them).
 */
@Global()
@Module({
  providers: [AccessChangeBus, AccessVersionService, AccessVersionSubscriber],
  exports: [AccessChangeBus, AccessVersionService],
})
export class AccessVersionModule {}
