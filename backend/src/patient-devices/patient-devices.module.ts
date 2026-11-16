import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientDevice } from './patient-device.entity';
import { PatientDevicesService } from './patient-devices.service';

/**
 * Push devices of patient accounts (M3-07). A plain module (no controllers):
 * the notifications module imports it to find a patient's phones, and the
 * patient API (`patient-app/devices`) imports it to register them.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PatientDevice])],
  providers: [PatientDevicesService],
  exports: [PatientDevicesService],
})
export class PatientDevicesModule {}
