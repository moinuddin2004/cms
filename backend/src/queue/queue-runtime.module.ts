import { DynamicModule, Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessRole, runsHttp, runsJobs } from 'src/common/runtime/process-role';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { User } from 'src/user/entities/user.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { QueueModule } from './queue.module';
import { QueueSession } from './entities/queue-session.entity';
import { QueueGateway } from './realtime/queue.gateway';
import { OutboxRelayService } from './realtime/outbox-relay.service';
import { QueueJobsService } from './jobs/queue-jobs.service';
import { REALTIME_PUBLISHER } from './realtime/realtime-bus';
import { RedisRealtimePublisher } from './realtime/redis-realtime.publisher';
import { RedisRealtimeSubscriber } from './realtime/redis-realtime.subscriber';
import { InProcessRealtimePublisher } from './realtime/in-process-realtime.publisher';

/**
 * The queue's process-specific half, wired per role:
 * - api:    Socket.IO gateway + Redis subscriber (events from the worker)
 * - worker: outbox relay publishing to Redis + background jobs
 * - all:    gateway + relay publishing in-process + jobs (no Redis needed)
 */
@Module({})
export class QueueRuntimeModule {
  static forRole(role: ProcessRole): DynamicModule {
    const providers: Provider[] = [];

    if (runsHttp(role)) {
      providers.push(QueueGateway, AuthorizationService);
      if (role === 'api') providers.push(RedisRealtimeSubscriber);
    }
    if (runsJobs(role)) {
      providers.push(OutboxRelayService, QueueJobsService, {
        provide: REALTIME_PUBLISHER,
        useClass: role === 'worker' ? RedisRealtimePublisher : InProcessRealtimePublisher,
      });
    }

    return {
      module: QueueRuntimeModule,
      imports: [
        QueueModule,
        TypeOrmModule.forFeature([
          QueueSession,
          // for AuthorizationService (socket room access checks)
          User,
          OrganizationOwnership,
          Organization,
          Location,
          Employee,
          EmployeeOrgLocationAssignment,
        ]),
        JwtModule.register({}),
      ],
      providers,
    };
  }
}
