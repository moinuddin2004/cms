import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  QcResult,
  RemakeReason,
  ResponsibleParty,
  ShipmentCondition,
  ShipmentContents,
  ShipmentDirection,
  ShipmentStatus,
} from '../enums/production.enums';

export class OptionalVersionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class ReasonDto extends OptionalVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

// ── lab side ─────────────────────────────────────────────────────────────

export class ProductionItemsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number =
    25;
}

export class AssignDto {
  @IsUUID()
  labMemberId: string;
}

export class QcDto extends OptionalVersionDto {
  @IsEnum(QcResult)
  result: QcResult;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ── shipments ────────────────────────────────────────────────────────────

export class ShipmentLineDto {
  @IsUUID()
  itemId: string;

  @IsOptional()
  @IsEnum(ShipmentContents)
  contents?: ShipmentContents;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(64)
  quantity?: number;
}

export class DispatchShipmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ShipmentLineDto)
  lines: ShipmentLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  courierName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReceiveLineDto {
  @IsUUID()
  shipmentItemId: string;

  @IsInt()
  @Min(0)
  @Max(64)
  receivedQty: number;

  @IsEnum(ShipmentCondition)
  condition: ShipmentCondition;

  @IsOptional()
  @IsEnum(QcResult)
  qcResult?: QcResult;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  qcNotes?: string;
}

export class ReceiveShipmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines: ReceiveLineDto[];

  /** The receive screen was opened by scanning the slip's QR code. */
  @IsOptional()
  @IsBoolean()
  viaQr?: boolean;
}

export class LostShipmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class ShipmentsQueryDto {
  @IsOptional()
  @IsEnum(ShipmentDirection)
  direction?: ShipmentDirection;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number =
    25;
}

// ── clinic: try-in, decisions, remakes ───────────────────────────────────

export class TryinDto extends OptionalVersionDto {
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class StageDecisionDto extends OptionalVersionDto {
  @IsIn(['approve', 'correction'])
  decision: 'approve' | 'correction';

  /** Required for a correction: what the lab must change. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RejectWorkDto extends OptionalVersionDto {
  @IsEnum(RemakeReason)
  reasonCode: RemakeReason;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class RequestRemakeDto {
  @IsEnum(RemakeReason)
  reasonCode: RemakeReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RemakeDecisionDto {
  @IsIn(['agree', 'close'])
  decision: 'agree' | 'close';

  @IsInt()
  @Min(1)
  version: number;

  /** Required to agree; `undetermined` can't be agreed. */
  @IsOptional()
  @IsEnum(ResponsibleParty)
  responsibleParty?: ResponsibleParty;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class DisputeRemakeDto {
  @IsInt()
  @Min(1)
  version: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note: string;
}

export class RemakesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}
