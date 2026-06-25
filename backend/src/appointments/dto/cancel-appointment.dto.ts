import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CancelReason } from '../enums/cancel-reason.enum';

export class CancelAppointmentDto {
  /** Structured reason for analytics (no_show / patient_left / other). */
  @IsEnum(CancelReason)
  @IsOptional()
  reasonCode?: CancelReason;

  /** Optional free-text detail. */
  @IsString()
  @IsOptional()
  reason?: string;
}
