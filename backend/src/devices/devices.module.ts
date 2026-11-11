import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { UserDevice } from './entities/user-device.entity';

/**
 * Push devices of clinic users. The notifications module imports this module
 * to resolve a user's tokens when sending `push`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserDevice])],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
