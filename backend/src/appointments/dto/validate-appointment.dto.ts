import {
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

export class ValidateAppointmentDto {
  @IsUUID()
  doctorId: string;

  @IsDateString()
  startTime: string;

  @IsInt()
  @Min(5)
  @Max(480)
  duration: number;

  @IsUUID()
  @IsOptional()
  excludeAppointmentId?: string; // Exclude current appointment during reschedule
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  conflictLocation?: string;
  suggestedStartTime?: string;
}
