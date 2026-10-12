import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Optional "Urgent priority?" answer given at check-in or walk-in. */
export class UrgentDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  urgentReason?: string;
}

export class CheckInDto extends UrgentDto {}

/**
 * Walk-in registration. A doctor is required — tokens belong to a doctor.
 * Give an existing `patientId`, or `patientName` + `patientPhone` to create
 * the patient at the desk.
 */
export class WalkInDto extends UrgentDto {
  @IsUUID()
  doctorId: string;

  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ValidateIf((o: WalkInDto) => !o.patientId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  patientName?: string;

  @ValidateIf((o: WalkInDto) => !o.patientId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  patientPhone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reasonForVisit?: string;

  /** Proceed although the patient is active in another doctor's queue today. */
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}

export class ReasonDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class RequiredReasonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class SelectPatientDto extends ReasonDto {}

export class RejoinDto {
  /** MANUAL rejoin policy only: place the patient right after this waiting entry. */
  @IsUUID()
  @IsOptional()
  placeAfterEntryId?: string;
}

export class TransferDto extends ReasonDto {
  @IsUUID()
  toDoctorId: string;
}

export class EnsureSessionDto {
  /** Defaults to the signed-in doctor. */
  @IsUUID()
  @IsOptional()
  doctorId?: string;
}

export class SessionModeDto {
  @IsBoolean()
  smartQueueEnabled: boolean;
}

export class CloseDecisionDto {
  @IsUUID()
  entryId: string;

  @IsIn(['cancel', 'transfer'])
  action: 'cancel' | 'transfer';

  @ValidateIf((o: CloseDecisionDto) => o.action === 'transfer')
  @IsUUID()
  toDoctorId?: string;
}

/** Every waiting / skipped / on-hold entry must be decided before closing. */
export class CloseSessionDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CloseDecisionDto)
  decisions: CloseDecisionDto[];
}
