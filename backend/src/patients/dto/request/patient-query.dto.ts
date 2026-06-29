import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Gender } from '../../enums/gender.enum';
import { BloodGroup } from '../../enums/blood-group.enum';
import { PatientSource } from '../../enums/patient-source.enum';

export enum PatientSortBy {
  CREATED_AT = 'createdAt',
  FULL_NAME = 'fullName',
  PATIENT_NUMBER = 'patientNumber',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class PatientQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(PatientSource)
  source?: PatientSource;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === true) return true;
    if (value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBlacklisted?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isMinor?: boolean;

  @IsOptional()
  @IsEnum(PatientSortBy)
  sortBy?: PatientSortBy = PatientSortBy.CREATED_AT;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
