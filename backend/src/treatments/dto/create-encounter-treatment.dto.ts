import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for `POST /encounters/:encounterId/treatments` (Flow E). The patient and
 * encounter are both derived from the route, so they are NOT part of the body.
 */
export class CreateEncounterTreatmentDto {
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
