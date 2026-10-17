import {
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Body for `POST /encounters/:encounterId/treatments` (Flow E). The patient and
 * encounter are both derived from the route, so they are NOT part of the body.
 */
export class CreateEncounterTreatmentDto {
  /** Optional — the treatment plan (from the Treatment Plans page) it follows. */
  @IsOptional()
  @IsUUID()
  planTemplateId?: string;

  /**
   * Catalog service (kind PROCEDURE) the doctor picked. Billing prices the
   * charge from it; the doctor never sees or sends a price.
   */
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
  @IsDateString()
  date?: string;
}
