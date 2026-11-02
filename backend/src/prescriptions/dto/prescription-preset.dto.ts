import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PresetCategory } from '../enums/preset-category.enum';
import { MealRelation } from '../enums/meal-relation.enum';

export class CreateTemplateMedicineDto {
  @IsOptional()
  @IsUUID()
  medicineDirectoryId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  medicineName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  medicineNameUrdu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  type?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dosage: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  frequency: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  frequencyTiming?: string[];

  @IsOptional()
  @IsEnum(MealRelation)
  mealRelation?: MealRelation;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  duration: string;

  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @IsOptional()
  @IsString()
  specialInstructionsUrdu?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreatePrescriptionPresetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PresetCategory)
  category: PresetCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialtyTags?: string[];

  @IsOptional()
  @IsString()
  furtherPlan?: string;

  @IsOptional()
  @IsString()
  instructionsEnglish?: string;

  @IsOptional()
  @IsString()
  instructionsUrdu?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Template must include at least one medicine' })
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateMedicineDto)
  medicines: CreateTemplateMedicineDto[];
}

export class UpdatePrescriptionPresetDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(PresetCategory)
  category?: PresetCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialtyTags?: string[];

  @IsOptional()
  @IsString()
  furtherPlan?: string;

  @IsOptional()
  @IsString()
  instructionsEnglish?: string;

  @IsOptional()
  @IsString()
  instructionsUrdu?: string;

  /**
   * If provided, the service DELETES all existing medicines and INSERTS the
   * new set (same replace-all pattern used by ConsumptionTemplate).
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateMedicineDto)
  medicines?: CreateTemplateMedicineDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
