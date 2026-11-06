import { NotificationsModule } from 'src/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollRecord } from './entities/payroll-record.entity';
import { Location } from 'src/locations/entities/location.entity';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollExportService } from './payroll-export.service';
import { EmployeesModule } from 'src/employees/employees.module';

@Module({
  imports: [
    NotificationsModule,
    TypeOrmModule.forFeature([PayrollRecord, Location]),
    EmployeesModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollExportService],
})
export class PayrollModule {}
