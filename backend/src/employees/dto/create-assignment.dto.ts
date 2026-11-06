import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';
import { EmploymentType } from '../enums/employee.enums';

export class CreateAssignmentDto {
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @IsUUID()
  @IsNotEmpty()
  locationId: string;

  @IsOptional()
  @IsUUID()
  employmentRoleId?: string;

  @IsString()
  @IsNotEmpty()
  designation: string;

  @IsEnum(EmploymentType)
  @IsNotEmpty()
  employmentType: EmploymentType;

  @IsString()
  @IsNotEmpty()
  employeeCode: string;

  @IsDateString()
  @IsNotEmpty()
  joiningDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  grossSalary?: number;

  @IsOptional()
  @IsBoolean()
  hasPortalAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
