import { IsIn, IsOptional, IsString } from 'class-validator';
import { CancelReason } from '../enums/cancel-reason.enum';

export class CancelAppointmentDto {
  /**
   * Structured reason for analytics (patient_left / other). A no-show is not
   * a cancellation — use PATCH /appointments/:id/no-show instead.
   */
  @IsIn([CancelReason.PATIENT_LEFT, CancelReason.OTHER], {
    message:
      'reasonCode must be patient_left or other; use the no-show action for no-shows',
  })
  @IsOptional()
  reasonCode?: CancelReason;

  /** Optional free-text detail. */
  @IsString()
  @IsOptional()
  reason?: string;
}
