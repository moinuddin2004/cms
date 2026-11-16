import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_EVENTS_PER_BATCH } from '../product-event-catalog';

export class ProductEventDto {
  /** Validated against the catalog in the service (unknown → dropped). */
  @IsString()
  @MaxLength(60)
  name: string;

  /** Scalar props; the service keeps only allow-listed ones. */
  @IsOptional()
  @IsObject()
  props?: Record<string, unknown>;

  /** When it happened on the phone (batches can be sent late). */
  @IsOptional()
  @IsISO8601()
  at?: string;
}

/** `POST /me/events` and `POST /patient-api/events`. */
export class TrackEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_EVENTS_PER_BATCH)
  @ValidateNested({ each: true })
  @Type(() => ProductEventDto)
  events: ProductEventDto[];
}
