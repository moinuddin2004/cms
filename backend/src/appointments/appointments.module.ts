import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { EmployeeSchedule } from 'src/employees/entities/employee-schedule.entity';
import { Location } from 'src/locations/entities/location.entity';
import { LocationSettings } from 'src/locations/entities/location-settings.entity';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { QueueModule } from 'src/queue/queue.module';

import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      Patient,
      Employee,
      EmployeeOrgLocationAssignment,
      EmployeeSchedule,
      Location,
      LocationSettings,
    ]),
    QueueModule,
    NotificationsModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
