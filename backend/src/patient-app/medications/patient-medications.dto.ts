import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class MedicationsQueryDto {
  @IsOptional()
  @IsUUID()
  profileId?: string;

  /** Only schedules changed at/after this UTC instant (includes stopped ones). */
  @IsOptional()
  @IsISO8601()
  updatedSince?: string;
}

/** Strict allowlist: anything else is rejected by the global pipe. */
export class PatchMedicationDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @Matches(HHMM, { each: true, message: 'times must be "HH:mm" (24 h)' })
  times?: string[];

  /** `null` = the patient says "no end date". */
  @IsOptional()
  @Matches(YMD, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string | null;

  @IsOptional()
  @IsIn(['active', 'paused', 'stopped'])
  status?: 'active' | 'paused' | 'stopped';
}

export class DoseEventsQueryDto {
  @IsOptional()
  @IsUUID()
  profileId?: string;

  @IsISO8601()
  from: string;

  @IsISO8601()
  to: string;
}

export class DoseEventInputDto {
  @IsUUID()
  scheduleId: string;

  @IsISO8601()
  dueAt: string;

  @IsIn(['taken', 'skipped'])
  action: 'taken' | 'skipped';

  @IsISO8601()
  actedAt: string;
}

export class RecordDoseEventsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DoseEventInputDto)
  events: DoseEventInputDto[];
}


/** Response shapes (docs/07 §6.2). */
export interface MedicationScheduleDto {
  id: string;
  profileId: string;
  source: 'prescription' | 'manual';
  clinic: {
    organizationId: string;
    name: string;
    logoUrl: string | null;
    brandColor: string | null;
    clinicStatus: 'active' | 'suspended';
  } | null;
  prescriptionId: string | null;
  prescriptionMedicineId: string | null;
  name: string;
  nameUrdu: string | null;
  doseText: string;
  mealRelation: 'BEFORE_MEAL' | 'AFTER_MEAL' | 'WITH_MEAL' | 'EMPTY_STOMACH' | 'NONE';
  times: string[];
  startDate: string;
  endDate: string | null;
  endDateSource: 'parsed' | 'patient' | 'unknown';
  status: 'active' | 'paused' | 'completed' | 'stopped';
  instructions: string | null;
  instructionsUrdu: string | null;
  updatedAt: string;
}

export interface MedicationListDto {
  items: MedicationScheduleDto[];
  /** Pass as `updatedSince` for the next page; null = nothing more. */
  nextUpdatedSince: string | null;
}

export interface DoseEventDto {
  scheduleId: string;
  dueAt: string;
  action: 'taken' | 'skipped';
  actedAt: string;
}
