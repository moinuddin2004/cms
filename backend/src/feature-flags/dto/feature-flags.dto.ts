import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCatalogItemDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  key: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  module: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialtyTags?: string[];

  @IsOptional()
  @IsBoolean()
  enabledByDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCatalogItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  module?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialtyTags?: string[];

  @IsOptional()
  @IsBoolean()
  enabledByDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class ToggleFeatureDto {
  @IsNotEmpty()
  @IsBoolean()
  isEnabled: boolean;
}

export class BulkToggleDto {
  @IsArray()
  @IsString({ each: true })
  featureKeys: string[];

  @IsNotEmpty()
  @IsBoolean()
  isEnabled: boolean;
}
