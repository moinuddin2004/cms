import {
  IsArray,
  IsBoolean,
  IsDateString,
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

// ── Entitlement (super admin) ────────────────────────────────────────

export class SetEntitlementDto {
  @IsBoolean()
  entitled: boolean;

  /** Trial expiry (ISO date-time); null/omitted = no expiry. */
  @IsOptional()
  @IsDateString()
  until?: string | null;
}

export class BulkEntitlementDto {
  /** Either explicit keys or a whole catalog module. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featureKeys?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  module?: string;

  @IsBoolean()
  entitled: boolean;

  @IsOptional()
  @IsDateString()
  until?: string | null;
}

// ── Owner Features page ──────────────────────────────────────────────

export class SetFeatureEnabledDto {
  @IsBoolean()
  enabled: boolean;
}

export class SetLocationOverrideDto {
  @IsBoolean()
  disabled: boolean;
}
