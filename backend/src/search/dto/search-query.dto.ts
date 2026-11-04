import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SEARCH_TYPES } from '../search.types';
import type { SearchType } from '../search.types';

export class SearchQueryDto {
  @IsString()
  @MaxLength(100)
  q: string;

  /** Comma-separated subset of types; omitted = every type the caller may see. */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsIn(SEARCH_TYPES, { each: true })
  types?: SearchType[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
