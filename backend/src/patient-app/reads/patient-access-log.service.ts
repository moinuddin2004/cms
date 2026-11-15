import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientAccessLog } from '../entities/patient-access-log.entity';

export interface AccessLogEntry {
  profileId: string | null;
  organizationId: string;
  patientId: string;
  action: 'view_list' | 'view_detail';
  resourceType: 'appointment' | 'visit' | 'prescription' | 'invoice';
  resourceId: string | null;
}

/**
 * Who in the app looked at which clinic record (03 §3 rule 8). Best effort:
 * a failed write never breaks a read, and the warning carries no ids or PHI.
 */
@Injectable()
export class PatientAccessLogService {
  private readonly logger = new Logger(PatientAccessLogService.name);

  constructor(
    @InjectRepository(PatientAccessLog)
    private readonly repo: Repository<PatientAccessLog>,
  ) {}

  /** One row per distinct (org, patient) in the entries (lists dedupe). */
  async record(accountId: string, entries: AccessLogEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const seen = new Set<string>();
    const rows = entries.filter((e) => {
      const key = [
        e.organizationId,
        e.patientId,
        e.action,
        e.resourceType,
        e.resourceId ?? '',
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    try {
      await this.repo.insert(rows.map((e) => ({ ...e, accountId })));
    } catch {
      this.logger.warn('patient access log write failed');
    }
  }
}
