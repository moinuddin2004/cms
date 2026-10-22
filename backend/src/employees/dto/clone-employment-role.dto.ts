import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CloneEmploymentRoleDto {
  /** Defaults to "<source name> (copy)". */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  /** Required when the source role has high-risk permissions. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
