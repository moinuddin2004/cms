import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeeSalary } from './entities/employee-salary.entity';
import { EmployeeSchedule } from './entities/employee-schedule.entity';
import { EmployeeLocationAssignment } from './entities/employee-location-assignment.entity';
import { EmploymentRole } from './entities/employment-role.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeSalary,
      EmployeeSchedule,
      EmployeeLocationAssignment,
      EmploymentRole,
    ]),
  ],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
