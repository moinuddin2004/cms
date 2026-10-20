import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from 'src/labs/dto/lab.dto';
import {
  AttachmentVisibility,
  ChargeKind,
  MessageKind,
  OrderPriority,
} from '../enums/order.enums';

const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const YMD_MESSAGE = 'Use a date like 2026-10-19';
export const MAX_ORDER_ITEMS = 20;
const MAX_PAISA = 100_000_000_000;

/** One line of a draft. Answers are free-form until submit. */
export class OrderItemDto {
  /** Keep an existing draft line (its pinned versions) — omit for a new one. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  labServiceId: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  optionIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  rush?: boolean;

  /** Bill the patient as this treatment instead of the mapped default. */
  @IsOptional()
  @IsUUID()
  clinicTreatmentId?: string | null;

  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}

class OrderHeaderDto {
  @IsOptional()
  @IsUUID()
  doctorId?: string | null;

  @IsOptional()
  @IsEnum(OrderPriority)
  priority?: OrderPriority;

  @IsOptional()
  @Transform(trimToNull)
  @Matches(YMD, { message: YMD_MESSAGE })
  requestedOn?: string | null;

  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;

  @IsOptional()
  @IsUUID()
  treatmentId?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class CreateOrderDto extends OrderHeaderDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  labId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class UpdateOrderDto extends OrderHeaderDto {
  @IsInt()
  @Min(1)
  version: number;

  /** Replaces the draft's lines (ids keep existing lines). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];
}

export class FromTemplateDto extends OrderHeaderDto {
  @IsUUID()
  templateId: string;

  @IsUUID()
  patientId: string;
}

export class RepeatOrderDto {
  /** Another patient (default: the same patient). */
  @IsOptional()
  @IsUUID()
  patientId?: string;
}

export class VersionDto {
  @IsInt()
  @Min(1)
  version: number;
}

export class OrderTransitionDto extends VersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  action: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(1000)
  reason?: string | null;
}

export class ListOrdersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsUUID()
  labId?: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  /** Created on/after (location day). */
  @IsOptional()
  @Matches(YMD, { message: YMD_MESSAGE })
  from?: string;

  @IsOptional()
  @Matches(YMD, { message: YMD_MESSAGE })
  to?: string;

  /** Leave drafts out (e.g. "repeat last order"). */
  @IsOptional()
  @Transform(
    ({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
      obj[key] === 'true' || obj[key] === true,
  )
  @IsBoolean()
  submittedOnly?: boolean;
}

export class RevisionItemDto {
  @IsUUID()
  itemId: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  optionIds?: string[];

  @IsOptional()
  @IsBoolean()
  rush?: boolean;
}

export class CreateRevisionDto extends VersionDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsArray()
  @ArrayMaxSize(MAX_ORDER_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => RevisionItemDto)
  items: RevisionItemDto[];
}

export class CreateMessageDto {
  @IsIn([
    MessageKind.NOTE,
    MessageKind.REPLY,
    MessageKind.CLARIFICATION_REQUEST,
  ])
  kind: MessageKind;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsUUID()
  itemId?: string | null;
}

export class CreateChargeDto {
  @IsEnum(ChargeKind)
  kind: ChargeKind;

  @IsInt()
  @Min(1)
  @Max(MAX_PAISA)
  amountPaisa: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @IsOptional()
  @IsUUID()
  itemId?: string | null;
}

export class DecideChargeDto extends VersionDto {
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UploadAttachmentDto {
  @IsOptional()
  @IsEnum(AttachmentVisibility)
  visibility?: AttachmentVisibility;

  @IsOptional()
  @IsUUID()
  itemId?: string;
}

export class LabOrdersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}
