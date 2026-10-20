import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngineModule } from 'src/engine/engine.module';
import { LabOrdersModule } from 'src/lab-orders/lab-orders.module';
import { LabsModule } from 'src/labs/labs.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { LabOrderActionsService } from './actions/lab-order-actions.service';
import { ClinicLabAccessController } from './controllers/clinic-lab-access.controller';
import { LabPortalOrderActionsController } from './controllers/lab-portal-order-actions.controller';
import { OrderLinkController } from './controllers/order-link.controller';
import { MagicLink } from './entities/magic-link.entity';
import { MagicLinkController } from './magic-links/magic-link.controller';
import { MagicLinksService } from './magic-links/magic-links.service';

/**
 * Lab management — Sprint 7, lab access (lab ERD §7, §10 "Lab accept",
 * §13, §14 steps 4–5): the lab's answer to an order (accept / reject /
 * clarification / date change) through the portal, a no-login magic link,
 * or a clinic proxy; magic links (created at submit, resend, revoke, auto
 * revoke on close, token only in the message at send time); internal
 * notifications for each answer; the work-order QR resolver.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MagicLink]),
    EngineModule,
    LabsModule,
    LabOrdersModule,
    NotificationsModule,
  ],
  controllers: [
    MagicLinkController,
    LabPortalOrderActionsController,
    ClinicLabAccessController,
    OrderLinkController,
  ],
  providers: [MagicLinksService, LabOrderActionsService],
  exports: [MagicLinksService, LabOrderActionsService],
})
export class LabAccessModule {}
