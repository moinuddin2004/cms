import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import type { Grant } from 'src/access/catalog/permissions';
import { IsPermissionMap } from 'src/access/validation/is-permission-map';
import { HOME_ROUTE_PATTERN } from '../employment-roles.rules';

export class UpdateEmploymentRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** `{ [permission]: scope | true }`, catalog keys only. Replaces the map. */
  @IsOptional()
  @IsPermissionMap()
  permissions?: Record<string, Grant>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  /** In-app path members land on after login. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(HOME_ROUTE_PATTERN, {
    message: 'homeRoute must be an app path like /queue/doctor',
  })
  homeRoute?: string | null;

  /** Required when this change grants a high-risk permission; kept in the audit log. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
