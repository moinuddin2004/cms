import { IsDateString, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * Body for `PATCH /encounters/:id` — the doctor's notes for this visit.
 * Every field is optional so the screen can auto-save one field at a time;
 * send `null` (or an empty string) to clear a value.
 */
export class UpdateEncounterNotesDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  chiefComplaint?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  examination?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  diagnosis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  advice?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsDateString()
  followUpDate?: string | null;
}
