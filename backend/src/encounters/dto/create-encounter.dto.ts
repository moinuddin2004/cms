import { IsUUID, IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateEncounterDto {
  @IsUUID()
  appointmentId: string;

  @IsOptional()
  @IsString()
  reason?: string;

  /** Defaults to now() when omitted. */
  @IsOptional()
  @IsDateString()
  encounterDate?: string;
}
