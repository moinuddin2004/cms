import {
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { AppointmentType } from 'src/common/enums/appointment-type.enum';

export class UpdateAppointmentDto {
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsInt()
  @Min(5)
  @Max(480)
  @IsOptional()
  duration?: number;

  @IsEnum(AppointmentType)
  @IsOptional()
  type?: AppointmentType;

  @IsString()
  @IsOptional()
  notes?: string;

  /** Move outside working hours / past the daily limit (`appointments.override_rules`). */
  @IsBoolean()
  @IsOptional()
  overrideRules?: boolean;
}
