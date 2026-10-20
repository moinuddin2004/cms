import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngineModule } from 'src/engine/engine.module';
import { LabOrdersModule } from 'src/lab-orders/lab-orders.module';
import { LabsModule } from 'src/labs/labs.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import {
  ClinicProductionController,
  ClinicShipmentsController,
} from './controllers/clinic-production.controller';
import { LabProductionController } from './controllers/lab-production.controller';
import { OrderItemStage } from './entities/order-item-stage.entity';
import {
  ItemAssignment,
  ItemWarranty,
  RemakeRequest,
  Shipment,
  ShipmentItem,
} from './entities/production-records.entity';
import { ClinicProductionService } from './services/clinic-production.service';
import { LabWorkService } from './services/lab-work.service';
import { ProductionReaderService } from './services/production-reader.service';
import { ShipmentsService } from './services/shipments.service';
import { ProductionNotifier } from './workflow/production-notifier';
import { ProductionWorkflowService } from './workflow/production-workflow.service';
import {
  CheckWarrantyOnRemakeEffect,
  InitStagesEffect,
  StartWarrantyEffect,
} from './workflow/production.effects';

/**
 * Lab management — Sprint 8, production (lab ERD §5b, §9a/§9b, §10
 * "Shipment receive" + "Remake decision", §14 steps 6–8): try-in stages
 * per item (round loop), technician assignments, shipments both ways with
 * QC / partial receiving / lost, remake requests with responsibility and
 * warranty, item warranties. Registers the `stage` workflow adapter and the
 * `init_stages`, `start_warranty`, `check_warranty_on_remake` effects.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderItemStage,
      ItemAssignment,
      Shipment,
      ShipmentItem,
      RemakeRequest,
      ItemWarranty,
    ]),
    EngineModule,
    LabsModule,
    LabOrdersModule,
    NotificationsModule,
  ],
  controllers: [
    ClinicProductionController,
    ClinicShipmentsController,
    LabProductionController,
  ],
  providers: [
    ProductionNotifier,
    ProductionWorkflowService,
    InitStagesEffect,
    StartWarrantyEffect,
    CheckWarrantyOnRemakeEffect,
    ProductionReaderService,
    LabWorkService,
    ShipmentsService,
    ClinicProductionService,
  ],
  exports: [ProductionWorkflowService, ProductionReaderService],
})
export class LabProductionModule {}
