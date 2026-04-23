import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender, EmploymentType } from '../enums/employee.enums';

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

  @IsString()
  @IsNotEmpty()
  designation: string;

  @IsUUID()
  @IsNotEmpty()
  employmentRoleId: string;

  @IsEnum(EmploymentType)
  @IsNotEmpty()
  employmentType: EmploymentType;

  @IsDateString()
  @IsNotEmpty()
  joiningDate: string;

  @IsUUID()
  @IsNotEmpty()
  primaryLocationId: string;

  @IsOptional()
  @IsBoolean()
  hasPortalAccess?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  profilePictureUrl?: string;
}
