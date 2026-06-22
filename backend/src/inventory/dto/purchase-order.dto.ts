import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';

export class CreatePOItemDto {
  @IsUUID()
  inventoryItemId: string;

  @IsNumber()
  @Min(1)
  orderedQuantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsNumber()
  taxRate?: number;
  // percentage, e.g. 16 for 16%

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePOItemDto)
  items: CreatePOItemDto[];
}

export class UpdatePurchaseOrderStatusDto {
  @IsEnum(PurchaseOrderStatus)
  status: PurchaseOrderStatus;
}

export class ReceivePOItemDto {
  @IsUUID()
  poItemId: string;

  @IsNumber()
  @Min(0)
  receivedQuantity: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class BulkReceiveDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePOItemDto)
  items: ReceivePOItemDto[];
}

export class PurchaseOrderFilterDto {
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
