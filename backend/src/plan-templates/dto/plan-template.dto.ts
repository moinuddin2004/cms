import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DiscountKind } from 'src/billing/enums/billing.enums';
import { PlanTemplateCategory } from '../enums/plan-template-category.enum';

/** One catalog service of the template; its name and price come from the catalog. */
export class PlanTemplateItemDto {
  @IsUUID()
  serviceId: string;

  @IsInt()
  @Min(1)
  @Max(60)
  estimatedSessions: number;

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
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PlanTemplateItemDto)
  items: PlanTemplateItemDto[];

  /** null / absent = no discount. */
  @IsOptional()
  @IsEnum(DiscountKind)
  discountKind?: DiscountKind | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number | null;
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
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PlanTemplateItemDto)
  items?: PlanTemplateItemDto[];

  @IsOptional()
  @IsEnum(DiscountKind)
  discountKind?: DiscountKind | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
