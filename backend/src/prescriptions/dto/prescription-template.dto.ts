import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PageSize, PageOrientation } from '../enums/page-size.enum';

/**
 * `header`, `footer`, and `styling` are validated as plain objects — the
 * concrete shape is documented in the entity comment and enforced loosely
 * here so we can extend fields without DTO churn.
 */
export class CreatePrescriptionTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEnum(PageSize)
  pageSize?: PageSize;

  @IsOptional()
  @IsEnum(PageOrientation)
  orientation?: PageOrientation;

  @IsOptional()
  @IsNumber()
  customWidthMm?: number;

  @IsOptional()
  @IsNumber()
  customHeightMm?: number;

  @IsOptional()
  @IsObject()
  header?: Record<string, any>;

  @IsOptional()
  @IsObject()
  footer?: Record<string, any>;

  @IsOptional()
  @IsObject()
  styling?: Record<string, any>;
}

export class UpdatePrescriptionTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEnum(PageSize)
  pageSize?: PageSize;

  @IsOptional()
  @IsEnum(PageOrientation)
  orientation?: PageOrientation;

  @IsOptional()
  @IsNumber()
  customWidthMm?: number;

  @IsOptional()
  @IsNumber()
  customHeightMm?: number;

  @IsOptional()
  @IsObject()
  header?: Record<string, any>;

  @IsOptional()
  @IsObject()
  footer?: Record<string, any>;

  @IsOptional()
  @IsObject()
  styling?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
