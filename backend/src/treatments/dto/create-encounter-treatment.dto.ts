import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsUUID,
  MaxLength,
  Min,
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

  @IsString()
  @MaxLength(200)
  treatmentName: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsDateString()
  date?: string;
}
