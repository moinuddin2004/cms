import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  Min,
} from 'class-validator';
import {
  IMPORT_MAX_DRY_RUN_ROWS,
  type ImportRow,
} from '../../import/patient-import';

export const DUPLICATE_STRATEGIES = ['skip', 'create'] as const;
export type DuplicateStrategy = (typeof DUPLICATE_STRATEGIES)[number];

/**
 * `POST /patients/import`. Each row holds patient fields already mapped from
 * the file's columns (keys from `IMPORT_FIELDS`, values as the file had them).
 * A dry run checks up to a whole file (5000 rows); a real import takes at
 * most 1000 rows per request (the client sends batches).
 */
export class ImportPatientsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(IMPORT_MAX_DRY_RUN_ROWS)
  @IsObject({ each: true })
  rows: ImportRow[];

  @IsBoolean()
  dryRun: boolean;

  @IsIn(DUPLICATE_STRATEGIES)
  duplicateStrategy: DuplicateStrategy;

  /** Index of `rows[0]` in the whole file, so results and messages use file positions. */
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
