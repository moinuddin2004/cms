import { NotificationsModule } from 'src/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueuePolicy } from './entities/queue-policy.entity';
import { QueueSession } from './entities/queue-session.entity';
import { QueueEntry } from './entities/queue-entry.entity';
import { QueueEvent } from './entities/queue-event.entity';
import { OutboxMessage } from './entities/outbox-message.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { QueuePoliciesService } from './services/queue-policies.service';
import { TokenEngine } from './services/token-engine.service';
import { QueueQueryService } from './services/queue-query.service';
import { QueueVisitToken } from './entities/queue-visit-token.entity';
import { QueuePositionService } from './services/queue-position.service';
import { VisitService } from './visit/visit.service';
import { VisitController, VisitLinkController } from './visit/visit.controller';
import { QueueOrchestrator } from './services/queue-orchestrator.service';
import { QueueController } from './controllers/queue.controller';
import { DoctorQueueController } from './controllers/doctor-queue.controller';
import { DisplayController } from './controllers/display.controller';
import { EncountersModule } from 'src/encounters/encounters.module';
import { BillingModule } from 'src/billing/billing.module';
import { PatientDevicesModule } from 'src/patient-devices/patient-devices.module';

/**
 * Doctor-wise clinic queue: everything after a patient arrives.
 * Booking stays in AppointmentsModule; check-in hands over to the
 * QueueOrchestrator exported from here.
 *
 * Process-specific parts (Socket.IO gateway, outbox relay, jobs) live in
 * QueueRuntimeModule, which AppModule wires per process role.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      QueuePolicy,
      QueueSession,
      QueueEntry,
      QueueEvent,
      OutboxMessage,
      IdempotencyKey,
      QueueVisitToken,
    ]),
    NotificationsModule,
    PatientDevicesModule,
    EncountersModule,
    BillingModule,
  ],
  controllers: [QueueController, DoctorQueueController, DisplayController, VisitController, VisitLinkController],
  providers: [
    QueuePoliciesService,
    TokenEngine,
    QueueQueryService,
    QueueOrchestrator,
    QueuePositionService,
    VisitService,
  ],
  exports: [QueueOrchestrator, QueueQueryService, QueuePoliciesService, QueuePositionService],
})
export class QueueModule {}
