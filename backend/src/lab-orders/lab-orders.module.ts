import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngineModule } from 'src/engine/engine.module';
import { LabCatalogModule } from 'src/lab-catalog/lab-catalog.module';
import { LabsModule } from 'src/labs/labs.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import {
  ATTACHMENT_STORAGE,
  CloudinaryAttachmentStorage,
} from './attachments/attachment-storage';
import { AttachmentsService } from './attachments/attachments.service';
import { LabOrdersPortalController } from './controllers/lab-orders-portal.controller';
import { LabOrdersController } from './controllers/lab-orders.controller';
import { Attachment } from './entities/attachment.entity';
import {
  DentalItemDetails,
  ItemFormResponse,
  ItemTooth,
} from './entities/item-parts.entity';
import { LabOrderItem } from './entities/lab-order-item.entity';
import { LabOrder } from './entities/lab-order.entity';
import {
  OrderChargeRequest,
  OrderMessage,
  OrderRevision,
} from './entities/order-records.entity';
import { LabOrdersPortalService } from './portal/lab-orders-portal.service';
import { SnapshotFreezeSubscriber } from './snapshot/snapshot-freeze';
import { LabOrdersService } from './services/lab-orders.service';
import { OrderDraftsService } from './services/order-drafts.service';
import { OrderReaderService } from './services/order-reader.service';
import { OrderSubmitService } from './services/order-submit.service';
import { OrderLifecycleHooks } from './workflow/order-hooks';
import { OrderWorkflowService } from './workflow/order-workflow.service';

/**
 * Lab management — Sprint 6, order creation (lab ERD §5a, §10, §14 steps
 * 2–5): drafts, submit (one transaction: number, price snapshot, form
 * validation, teeth, promotions, revision 1, status, outbox), revisions,
 * messages, charge requests, attachments, work-order print and the lab
 * portal's order reads. Registers the `order` / `item` workflow adapters.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      LabOrder,
      LabOrderItem,
      ItemTooth,
      DentalItemDetails,
      ItemFormResponse,
      OrderRevision,
      OrderMessage,
      OrderChargeRequest,
      Attachment,
    ]),
    EngineModule,
    LabsModule,
    LabCatalogModule,
    NotificationsModule,
  ],
  controllers: [LabOrdersController, LabOrdersPortalController],
  providers: [
    OrderLifecycleHooks,
    OrderWorkflowService,
    OrderDraftsService,
    OrderSubmitService,
    OrderReaderService,
    LabOrdersService,
    LabOrdersPortalService,
    AttachmentsService,
    SnapshotFreezeSubscriber,
    { provide: ATTACHMENT_STORAGE, useClass: CloudinaryAttachmentStorage },
  ],
  exports: [
    OrderWorkflowService,
    LabOrdersService,
    OrderSubmitService,
    OrderReaderService,
    LabOrdersPortalService,
    AttachmentsService,
    OrderLifecycleHooks,
  ],
})
export class LabOrdersModule {}
