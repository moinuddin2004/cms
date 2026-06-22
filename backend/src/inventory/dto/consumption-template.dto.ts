import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTemplateItemDto {
  @IsUUID()
  inventoryItemId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class CreateConsumptionTemplateDto {
  @IsString()
  name: string;

  @IsString()
  procedureName: string;

  @IsOptional()
  @IsString()
  appointmentType?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateItemDto)
  items: CreateTemplateItemDto[];
}

export class UpdateConsumptionTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  procedureName?: string;

  @IsOptional()
  @IsString()
  appointmentType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateItemDto)
  items?: CreateTemplateItemDto[];
  // If provided → replace all existing items. If omitted → leave items untouched.
}
