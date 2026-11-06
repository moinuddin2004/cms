import { NotificationsModule } from 'src/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

// Entities
import { InventoryCategory } from './entities/inventory-category.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { Supplier } from './entities/supplier.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { ConsumptionTemplate } from './entities/consumption-template.entity';
import { ConsumptionTemplateItem } from './entities/consumption-template-item.entity';
import { PatientConsumption } from './entities/patient-consumption.entity';
import { PatientConsumptionItem } from './entities/patient-consumption-item.entity';

// Services
import { InventoryCategoryService } from './services/inventory-category.service';
import { InventoryService } from './services/inventory.service';
import { SupplierService } from './services/supplier.service';
import { PurchaseOrderService } from './services/purchase-order.service';
import { ConsumptionTemplateService } from './services/consumption-template.service';
import { PatientConsumptionService } from './services/patient-consumption.service';
import { InventoryAlertService } from './services/inventory-alerts.service';

// Controllers
import { InventoryController } from './controllers/inventory.controller';
import { SupplierController } from './controllers/supplier.controller';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { ConsumptionTemplateController } from './controllers/consumption-template.controller';
import { PatientConsumptionController } from './controllers/patient-consumption.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryCategory,
      InventoryItem,
      StockMovement,
      Supplier,
      PurchaseOrder,
      PurchaseOrderItem,
      ConsumptionTemplate,
      ConsumptionTemplateItem,
      PatientConsumption,
      PatientConsumptionItem,
    ]),
    FeatureFlagsModule,
    NotificationsModule,
  ],
  controllers: [
    InventoryController,
    SupplierController,
    PurchaseOrderController,
    ConsumptionTemplateController,
    PatientConsumptionController,
  ],
  providers: [
    InventoryCategoryService,
    InventoryService,
    SupplierService,
    PurchaseOrderService,
    ConsumptionTemplateService,
    PatientConsumptionService,
    InventoryAlertService,
  ],
  exports: [InventoryService, PatientConsumptionService],
})
export class InventoryModule {}
