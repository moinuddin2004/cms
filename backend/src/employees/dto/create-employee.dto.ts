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
} from 'class-validator';
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

  @IsOptional()
  @IsString()
  @MinLength(6)
  portalPassword?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  isPrimary?: boolean;
}
