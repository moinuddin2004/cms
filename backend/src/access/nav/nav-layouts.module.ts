import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NavLayout } from './nav-layout.entity';
import { NavLayoutsController } from './nav-layouts.controller';
import { NavLayoutsService } from './nav-layouts.service';

/**
 * Clinic sidebar layouts (sprint N). AuditService and AccessVersionService
 * come from their global modules.
 */
@Module({
  imports: [TypeOrmModule.forFeature([NavLayout])],
  controllers: [NavLayoutsController],
  providers: [NavLayoutsService],
  exports: [NavLayoutsService],
})
export class NavLayoutsModule {}
