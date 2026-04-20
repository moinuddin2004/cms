import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeeSchedule } from './entities/employee-schedule.entity';
import { EmployeeLocationAssignment } from './entities/employee-location-assignment.entity';
import { EmploymentRole } from './entities/employment-role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeSchedule,
      EmployeeLocationAssignment,
      EmploymentRole,
    ]),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class EmployeesModule {}
