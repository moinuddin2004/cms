import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
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

/** One service of the plan. `id` keeps an existing line on update. */
export class PlanLineDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  serviceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  toothNumber?: string | null;

  @IsInt()
  @Min(1)
  @Max(60)
  estimatedSessions: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class CreateTreatmentPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  planName?: string;

  @IsOptional()
  @IsUUID()
  planTemplateId?: string;

  /** The visit it is made in; completing that visit bills the plan. */
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  /** Defaults to the doctor creating the plan. */
  @IsOptional()
  @IsUUID()
  dentistId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PlanLineDto)
  items: PlanLineDto[];

  /** Needs `billing.discount.apply`; otherwise the template's discount applies. */
  @IsOptional()
  @IsEnum(DiscountKind)
  discountKind?: DiscountKind | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number | null;
}

export class UpdateTreatmentPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  planName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PlanLineDto)
  items?: PlanLineDto[];

  @IsOptional()
  @IsEnum(DiscountKind)
  discountKind?: DiscountKind | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number | null;
}

/** Reception's discount change; null kind removes it. */
export class PlanDiscountDto {
  @IsOptional()
  @IsEnum(DiscountKind)
  discountKind: DiscountKind | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number | null;
}

/** One session of a plan step was done (in this visit, when given). */
export class PlanSessionDto {
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
