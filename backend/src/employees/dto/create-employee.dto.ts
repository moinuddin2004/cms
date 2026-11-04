import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsDateString,
  IsUUID,
  IsEmail,
  ValidateNested,
} from 'class-validator';
import { IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { CompensationPlanDto } from 'src/billing/commissions/dto/compensation.dto';
import { Gender } from '../enums/employee.enums';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsString()
  cnic?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  profilePictureUrl?: string;

  // ── Assignment fields (for initial assignment at current location) ──

  @IsString()
  @IsNotEmpty()
  designation: string;

  @IsOptional()
  @IsUUID()
  employmentRoleId?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  grossSalary?: number;

  @IsOptional()
  hasPortalAccess?: boolean;

  @IsOptional()
  @IsEmail()
  portalEmail?: string;

  /**
   * How the new login signs in: 'password' (default, needs portalPassword)
   * or 'google' (no password — linked on their first Google sign-in with
   * portalEmail). An existing account with portalEmail is reused as is.
   */
  @IsOptional()
  @IsIn(['password', 'google'])
  portalLoginMethod?: 'password' | 'google';

  @IsOptional()
  @IsString()
  @MinLength(6)
  portalPassword?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  isPrimary?: boolean;

  /** Optional compensation step; default: salaried from `grossSalary`. */
  @IsOptional()
  @ValidateNested()
  @Type(() => CompensationPlanDto)
  compensation?: CompensationPlanDto;
}
