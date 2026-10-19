import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { StatusHistory } from './entities/status-history.entity';

/** `audit_logs` + `status_history` writers, available everywhere. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, StatusHistory])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
