import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ActorRef } from 'src/common/audit/audit.enums';
import { ClockService } from 'src/common/clock/clock.service';
import { AppLogger } from 'src/common/services/logger.service';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Patient } from '../entities/patient.entity';
import { PatientsService } from '../patients.service';
import { CreatePatientDto } from '../dto/request/create-patient.dto';
import { ImportPatientsDto } from '../dto/request/import-patients.dto';
import {
  addToDuplicateIndex,
  emptyDuplicateIndex,
  findDuplicate,
  IMPORT_FIELDS,
  IMPORT_MAX_ROWS_PER_REQUEST,
  ImportRow,
  validateImportRow,
} from './patient-import';

export type ImportRowStatus =
  | 'created'
  | 'would_create'
  | 'duplicate'
  | 'error';

export interface ImportRowResult {
  /** Position of the row in the whole file (0-based). */
  index: number;
  status: ImportRowStatus;
  patientId?: string;
  patientNumber?: string;
  errors?: string[];
}

export interface ImportResult {
  dryRun: boolean;
  rows: ImportRowResult[];
  totals: {
    total: number;
    created: number;
    wouldCreate: number;
    duplicates: number;
    errors: number;
  };
}

/** Keeps known field keys with string / number values only. */
function cleanRow(raw: unknown): ImportRow {
  const out: ImportRow = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of IMPORT_FIELDS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'string') out[key] = value.slice(0, 5000);
    else if (typeof value === 'number' && Number.isFinite(value))
      out[key] = value;
  }
  return out;
}

/**
 * Patient migration from a spreadsheet. Every row goes through
 * `PatientsService.create` — the same patient numbering, location scoping,
 * phone-uniqueness check and audit row as a patient added by hand — and each
 * row stands alone: one bad row never rolls back the others.
 */
@Injectable()
export class PatientImportService {
  /** Organizations with a (non dry-run) import running in this process. */
  private readonly running = new Set<string>();

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly patients: PatientsService,
    private readonly clock: ClockService,
    private readonly logger: AppLogger,
  ) {}

  async import(
    ctx: TenantContext,
    dto: ImportPatientsDto,
    actor: ActorRef,
  ): Promise<ImportResult> {
    const { organizationId } = ctx;
    if (!dto.dryRun && dto.rows.length > IMPORT_MAX_ROWS_PER_REQUEST) {
      throw new BadRequestException(
        `Send at most ${IMPORT_MAX_ROWS_PER_REQUEST} rows per import request`,
      );
    }
    if (!dto.dryRun) {
      // Patient numbers come from a count, so two imports for one clinic at
      // once would collide.
      if (this.running.has(organizationId)) {
        throw new ConflictException(
          'Another patient import is running for this clinic. Try again when it finishes.',
        );
      }
      this.running.add(organizationId);
    }

    try {
      return await this.run(ctx, dto, actor);
    } finally {
      if (!dto.dryRun) this.running.delete(organizationId);
    }
  }

  private async run(
    ctx: TenantContext,
    dto: ImportPatientsDto,
    actor: ActorRef,
  ): Promise<ImportResult> {
    const { organizationId, locationId } = ctx;
    const offset = dto.offset ?? 0;

    const tz = await this.clock.timezoneFor(locationId);
    const [y, m, d] = this.clock.today(tz).split('-').map(Number);
    const today = new Date(y, m - 1, d);

    // Duplicates: same (normalised) phone or CNIC as a patient already in
    // the organization, or as an earlier row of this file.
    const index = emptyDuplicateIndex();
    const existing = await this.patientRepo.find({
      where: { organizationId },
      select: ['id', 'phone', 'cnic', 'patientNumber', 'fullName'],
    });
    for (const p of existing) {
      addToDuplicateIndex(
        index,
        p.phone,
        p.cnic,
        `${p.patientNumber} (${p.fullName})`,
      );
    }

    const results: ImportRowResult[] = [];
    for (let i = 0; i < dto.rows.length; i++) {
      const rowIndex = offset + i;
      const { dto: payload, errors } = await validateImportRow(
        cleanRow(dto.rows[i]),
        today,
      );
      if (errors.length) {
        results.push({ index: rowIndex, status: 'error', errors });
        continue;
      }
      const phone = payload.phone as string;
      const cnic = payload.cnic as string | undefined;

      const dup = findDuplicate(index, phone, cnic);
      if (dup) {
        const what = dup.by === 'phone' ? 'phone number' : 'CNIC';
        if (dto.duplicateStrategy === 'skip') {
          results.push({
            index: rowIndex,
            status: 'duplicate',
            errors: [`Same ${what} as ${dup.label}`],
          });
          continue;
        }
        if (dup.by === 'phone') {
          // Phone numbers are unique per clinic for every patient create.
          results.push({
            index: rowIndex,
            status: 'error',
            errors: [
              `Same phone number as ${dup.label} — two patients cannot share a phone number`,
            ],
          });
          continue;
        }
      }

      if (dto.dryRun) {
        addToDuplicateIndex(
          index,
          phone,
          cnic,
          `row ${rowIndex + 1} of this file`,
        );
        results.push({ index: rowIndex, status: 'would_create' });
        continue;
      }

      try {
        const created = await this.patients.create(
          ctx,
          payload as unknown as CreatePatientDto,
          actor,
        );
        addToDuplicateIndex(
          index,
          phone,
          cnic,
          `${created.patientNumber} (${created.fullName})`,
        );
        results.push({
          index: rowIndex,
          status: 'created',
          patientId: created.id,
          patientNumber: created.patientNumber,
        });
      } catch (err) {
        results.push({
          index: rowIndex,
          status: 'error',
          errors: [errorText(err)],
        });
      }
    }

    const count = (s: ImportRowStatus) =>
      results.filter((r) => r.status === s).length;
    const totals = {
      total: results.length,
      created: count('created'),
      wouldCreate: count('would_create'),
      duplicates: count('duplicate'),
      errors: count('error'),
    };
    if (!dto.dryRun) {
      this.logger.info(
        `Patient import org=${organizationId}: ${totals.created} created, ${totals.duplicates} duplicates, ${totals.errors} errors`,
        PatientImportService.name,
      );
    }
    return { dryRun: dto.dryRun, rows: results, totals };
  }
}

function errorText(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'string') return body;
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join('; ');
    if (typeof message === 'string') return message;
    return err.message;
  }
  return 'Could not create this patient';
}
