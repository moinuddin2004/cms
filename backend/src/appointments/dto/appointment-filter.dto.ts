import {
  IsOptional,
  IsBoolean,
  IsIn,
  IsDateString,
  IsEnum,
  IsString,
  IsUUID,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AppointmentStatus } from 'src/common/enums/appointment-status.enum';
import { AppointmentType } from 'src/common/enums/appointment-type.enum';

export class AppointmentFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string; // Filter range start

  @IsOptional()
  @IsDateString()
  endDate?: string; // Filter range end

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  /**
   * An appointment type, or `walk_in` — which is not a booking type but lets
   * the list narrow to walk-ins only (see `includeWalkIns`).
   */
  @IsOptional()
  @IsIn([...Object.values(AppointmentType), 'walk_in'])
  type?: AppointmentType | 'walk_in';

  /**
   * Also return walk-ins (queue entries that never had a booking), merged
   * into the same sorted, paginated list. Off by default so the calendar and
   * other callers keep getting bookings only.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeWalkIns?: boolean;

  /** Free-text search across patient name, phone and patient number. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
