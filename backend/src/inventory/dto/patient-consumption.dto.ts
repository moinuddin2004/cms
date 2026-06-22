import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsBoolean,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordConsumptionItemDto {
  @IsUUID()
  inventoryItemId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsBoolean()
  wasFromTemplate: boolean;
}

export class RecordConsumptionDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsUUID()
  treatmentPlanId?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordConsumptionItemDto)
  items: RecordConsumptionItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConsumptionReportQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
