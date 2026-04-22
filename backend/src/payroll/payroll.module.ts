import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollRecord } from './entities/payroll-record.entity';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { EmployeesModule } from 'src/employees/employees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayrollRecord]),
    EmployeesModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
