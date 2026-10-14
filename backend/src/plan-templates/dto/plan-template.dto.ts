import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PlanTemplateCategory } from '../enums/plan-template-category.enum';

export class PlanTemplateItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  procedureName: string;

  @IsInt()
  @Min(1)
  estimatedSessions: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class CreatePlanTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsEnum(PlanTemplateCategory)
  category?: PlanTemplateCategory;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PlanTemplateItemDto)
  items: PlanTemplateItemDto[];
}

export class UpdatePlanTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(PlanTemplateCategory)
  category?: PlanTemplateCategory;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PlanTemplateItemDto)
  items?: PlanTemplateItemDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
