import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ItemUnit } from '../entities/inventory-item.entity';
import { StockMovementType } from '../entities/stock-movement.entity';

export class CreateInventoryItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsNumber()
  @Min(0)
  initialStock: number;
  // NOT the currentStock field — the starting quantity, recorded as INITIAL_STOCK movement

  @IsEnum(ItemUnit)
  unit: ItemUnit;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  sellingPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderQuantity?: number;

  @IsOptional()
  @IsNumber()
  maxStock?: number;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsNumber()
  expiryAlertDays?: number;

  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ItemUnit)
  unit?: ItemUnit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  sellingPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderQuantity?: number;

  @IsOptional()
  @IsNumber()
  maxStock?: number;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsNumber()
  expiryAlertDays?: number;

  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;
}

export class InventoryItemFilterDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  lowStockOnly?: boolean;
  // currentStock > 0 AND currentStock <= reorderLevel

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  expiringOnly?: boolean;
  // expiryDate IS NOT NULL AND expiryDate <= today + 30 days

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  outOfStockOnly?: boolean;
  // currentStock = 0

  @IsOptional()
  @IsString()
  search?: string;
  // matches name ILIKE or sku ILIKE

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

const MANUAL_MOVEMENT_TYPES = [
  StockMovementType.MANUAL_ADJUSTMENT,
  StockMovementType.WASTAGE,
  StockMovementType.RETURN_TO_SUPPLIER,
  StockMovementType.TRANSFER_IN,
  StockMovementType.TRANSFER_OUT,
];

export class AdjustStockDto {
  @IsNumber()
  quantity: number;
  // For MANUAL_ADJUSTMENT may be negative; for other types service derives the sign

  @IsEnum(MANUAL_MOVEMENT_TYPES, {
    message:
      'movementType must be one of MANUAL_ADJUSTMENT, WASTAGE, RETURN_TO_SUPPLIER, TRANSFER_IN, TRANSFER_OUT',
  })
  movementType: StockMovementType;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
  // Required for WASTAGE and MANUAL_ADJUSTMENT — enforced in service
}
