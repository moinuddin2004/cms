import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngineModule } from 'src/engine/engine.module';
import {
  PlatformLabServicesController,
  PlatformServiceCategoriesController,
} from './categories/platform-catalog.controller';
import { ServiceCategoriesService } from './categories/service-categories.service';
import { ClinicCatalogController } from './clinic/clinic-catalog.controller';
import { ClinicCatalogService } from './clinic/clinic-catalog.service';
import { LabServiceOption } from './entities/lab-service-option.entity';
import { LabServicePrice } from './entities/lab-service-price.entity';
import { LabService } from './entities/lab-service.entity';
import { OrderTemplate } from './entities/order-template.entity';
import { ServiceCategory } from './entities/service-category.entity';
import { ServiceMapping } from './entities/service-mapping.entity';
import { ServiceMappingsService } from './mappings/service-mappings.service';
import { LabPriceResolver } from './pricing/lab-price-resolver.service';
import { CatalogSeedService } from './seeds/catalog-seed.service';
import { LabServicePricesService } from './services/lab-service-prices.service';
import { LabServicesService } from './services/lab-services.service';
import { OrderTemplatesService } from './templates/order-templates.service';

/**
 * Lab management — Sprint 5 (lab ERD §4): service categories, lab
 * services with options and price windows (list + per-clinic negotiated),
 * clinic treatment ↔ lab service mappings, order templates, and the price
 * resolver Sprint 6 snapshots at order submit. The clinic's patient price
 * list is the billing catalog (`services` / `service_prices`), not a copy.
 * Imports EngineModule for the form resolver — which also makes the engine
 * seed (specialties) run before this module's category seed.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceCategory,
      LabService,
      LabServiceOption,
      LabServicePrice,
      ServiceMapping,
      OrderTemplate,
    ]),
    EngineModule,
  ],
  controllers: [
    PlatformServiceCategoriesController,
    PlatformLabServicesController,
    ClinicCatalogController,
  ],
  providers: [
    ServiceCategoriesService,
    LabServicesService,
    LabServicePricesService,
    ClinicCatalogService,
    ServiceMappingsService,
    OrderTemplatesService,
    LabPriceResolver,
    CatalogSeedService,
  ],
  exports: [
    LabServicesService,
    LabServicePricesService,
    LabPriceResolver,
    OrderTemplatesService,
  ],
})
export class LabCatalogModule {}
