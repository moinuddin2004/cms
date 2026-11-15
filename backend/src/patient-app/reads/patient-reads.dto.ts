import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ProfileFilterDto {
  @IsOptional()
  @IsUUID()
  profileId?: string;
}

export class AppointmentsQueryDto extends ProfileFilterDto {
  /** UTC instant, inclusive. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** UTC instant, exclusive. */
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class PagedProfileQueryDto extends ProfileFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
