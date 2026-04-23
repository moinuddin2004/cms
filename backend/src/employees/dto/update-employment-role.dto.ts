import { IsString, IsOptional, IsBoolean, MaxLength, MinLength } from 'class-validator';

export class UpdateEmploymentRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  permissions?: Record<string, boolean>;
}
