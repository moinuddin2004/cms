import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MedicineType } from '../enums/medicine-type.enum';
import { MealRelation } from '../enums/meal-relation.enum';

export class CreateMedicineDirectoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genericName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameUrdu?: string;

  @IsEnum(MedicineType)
  type: MedicineType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  strength?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultDosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultFrequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultDuration?: string;

  @IsOptional()
  @IsEnum(MealRelation)
  defaultMealRelation?: MealRelation;

  @IsOptional()
  @IsString()
  instructionsUrdu?: string;
}

export class UpdateMedicineDirectoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genericName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameUrdu?: string;

  @IsOptional()
  @IsEnum(MedicineType)
  type?: MedicineType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  strength?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultDosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultFrequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultDuration?: string;

  @IsOptional()
  @IsEnum(MealRelation)
  defaultMealRelation?: MealRelation;

  @IsOptional()
  @IsString()
  instructionsUrdu?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SearchMedicineDto {
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters' })
  query: string;

  @IsOptional()
  @IsEnum(MedicineType)
  type?: MedicineType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
