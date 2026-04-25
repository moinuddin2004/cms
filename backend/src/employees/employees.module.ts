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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeOrgLocationAssignment,
      EmployeeSchedule,
      EmploymentRole,
    ]),
  ],
  controllers: [EmployeesController, ScheduleController, EmploymentRolesController],
  providers: [EmployeesService, ScheduleService, EmploymentRolesService],
  exports: [EmployeesService, ScheduleService, EmploymentRolesService],
})
export class EmployeesModule {}
