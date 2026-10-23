import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from './entities/location.entity';
import { LocationSettings } from './entities/location-settings.entity';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';

import { AuthModule } from 'src/auth/auth.module';
import { SubscriptionsModule } from 'src/subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Location, LocationSettings]),
    AuthModule,
    SubscriptionsModule,
  ],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
