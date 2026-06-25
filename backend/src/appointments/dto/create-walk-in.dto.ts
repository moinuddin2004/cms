import {
  IsUUID,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsString,
  MaxLength,
} from 'class-validator';
import { AppointmentType } from 'src/common/enums/appointment-type.enum';

/**
 * Walk-in payload. Provide EITHER an existing `patientId`, OR
 * `patientName` + `patientPhone` to quick-create one at the desk.
 */
export class CreateWalkInDto {
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  patientName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  patientPhone?: string;

  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @IsEnum(AppointmentType)
  @IsOptional()
  type?: AppointmentType;

  @IsInt()
  @Min(5)
  @Max(480)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reasonForVisit?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isEmergency?: boolean;

  /** Skip the "patient already has an active token today" guard. */
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}
