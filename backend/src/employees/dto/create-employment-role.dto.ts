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

export class CreateEmploymentRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsBoolean()
  isSystemRole?: boolean;

  /** `{ [permission]: scope | true }`, catalog keys only. */
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
  @Matches(/^\/[A-Za-z0-9\-_/$.]*$/, {
    message: 'homeRoute must be an app path like /queue/doctor',
  })
  homeRoute?: string | null;
}
