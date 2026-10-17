import {
  IsUUID,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTreatmentDto {
  @IsUUID()
  patientId: string;

  /** Optional — link to the encounter this treatment was performed in. */
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  /** Optional — the treatment plan (from the Treatment Plans page) it follows. */
  @IsOptional()
  @IsUUID()
  planTemplateId?: string;

  /** Catalog service (kind PROCEDURE); when set it prices the charge and `cost` is ignored. */
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  /** Required without a `serviceId`; defaults to the service's name with one. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  treatmentName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number;

  /** Defaults to now() when omitted. */
  @IsOptional()
  @IsDateString()
  date?: string;
}
