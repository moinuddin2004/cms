import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEvent } from './entities/product-event.entity';
import { ProductEventsService } from './product-events.service';
import { StaffEventsController } from './staff-events.controller';

/** Privacy-safe product analytics (M2-13). The patient route lives in `patient-app/`. */
@Module({
  imports: [TypeOrmModule.forFeature([ProductEvent])],
  controllers: [StaffEventsController],
  providers: [ProductEventsService],
  exports: [ProductEventsService],
})
export class ProductEventsModule {}
