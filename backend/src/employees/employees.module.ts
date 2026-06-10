import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeeOrgLocationAssignment } from './entities/employee-org-location-assignment.entity';
import { EmployeeSchedule } from './entities/employee-schedule.entity';
import { EmploymentRole } from './entities/employment-role.entity';
import { EmployeesController } from './employees.controller';
import { ScheduleController } from './schedule.controller';
import { EmployeesService } from './employees.service';
import { ScheduleService } from './schedule.service';
import { EmploymentRolesController } from './employment-roles.controller';
import { EmploymentRolesService } from './employment-roles.service';
import { EmployeeLeave } from './entities/employee-leave.entity';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { DoctorAvailabilityOverride } from './entities/doctor-availability-override.entity';
import { AvailabilityOverrideController } from './availability-override.controller';
import { AvailabilityOverrideService } from './availability-override.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeOrgLocationAssignment,
      EmployeeSchedule,
      EmploymentRole,
      EmployeeLeave,
      DoctorAvailabilityOverride,
    ]),
  ],
  controllers: [
    EmployeesController,
    ScheduleController,
    EmploymentRolesController,
    LeaveController,
    AvailabilityOverrideController,
  ],
  providers: [
    EmployeesService,
    ScheduleService,
    EmploymentRolesService,
    LeaveService,
    AvailabilityOverrideService,
  ],
  exports: [
    EmployeesService,
    ScheduleService,
    EmploymentRolesService,
    LeaveService,
    AvailabilityOverrideService,
  ],
})
export class EmployeesModule {}
