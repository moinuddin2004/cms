import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanTemplate } from './entities/plan-template.entity';
import { PlanTemplatesController } from './plan-templates.controller';
import { PlanTemplatesService } from './plan-templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlanTemplate])],
  controllers: [PlanTemplatesController],
  providers: [PlanTemplatesService],
})
export class PlanTemplatesModule {}
