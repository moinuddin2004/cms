import {
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsString,
} from 'class-validator';
import { AppointmentType } from 'src/common/enums/appointment-type.enum';

export class CreateAppointmentDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  doctorId: string;

  @IsDateString()
  startTime: string;

  @IsInt()
  @Min(5)
  @Max(480)
  duration: number; // minutes

  @IsEnum(AppointmentType)
  @IsOptional()
  type?: AppointmentType;

  @IsString()
  @IsOptional()
  reasonForVisit?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isEmergency?: boolean;

  /** Book outside working hours / past the daily limit (`appointments.override_rules`). */
  @IsBoolean()
  @IsOptional()
  overrideRules?: boolean;
}
