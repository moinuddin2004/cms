import { DynamicModule, Module } from '@nestjs/common';
import { ProcessRole, runsJobs } from 'src/common/runtime/process-role';
import { NotificationRelayService } from './delivery/notification-relay.service';
import { NotificationsModule } from './notifications.module';

/** The sending loop, only where background jobs run (worker / all) — never on a second API. */
@Module({})
export class NotificationsRuntimeModule {
  static forRole(role: ProcessRole): DynamicModule {
    return {
      module: NotificationsRuntimeModule,
      imports: [NotificationsModule],
      providers: runsJobs(role) ? [NotificationRelayService] : [],
    };
  }
}
