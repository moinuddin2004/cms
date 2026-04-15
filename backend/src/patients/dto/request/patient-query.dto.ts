import { IsOptional, IsString, IsEnum, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Gender } from '../../enums/gender.enum';
import { BloodGroup } from '../../enums/blood-group.enum';

export enum PatientSortBy {
  CREATED_AT = 'createdAt',
  FULL_NAME = 'fullName',
  PATIENT_ID = 'patientId',
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
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(PatientSortBy)
  sortBy?: PatientSortBy = PatientSortBy.CREATED_AT;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
