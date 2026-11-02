import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { PlanTemplate } from './entities/plan-template.entity';
import { PlanTemplatesController } from './plan-templates.controller';
import { PlanTemplatesService } from './plan-templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlanTemplate, CatalogService])],
  controllers: [PlanTemplatesController],
  providers: [PlanTemplatesService],
})
export class PlanTemplatesModule {}
