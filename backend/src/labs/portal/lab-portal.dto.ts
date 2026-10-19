import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { LabFieldsDto } from '../dto/lab.dto';
import { LabLinkStatus } from '../enums/lab.enums';

/** Name, type and status stay with the platform; the lab edits contacts. */
export class UpdateLabContactDto extends LabFieldsDto {
  @IsInt()
  @Min(1)
  version: number;
}

export class PortalClinicsQueryDto {
  @IsOptional()
  @IsEnum(LabLinkStatus)
  status?: LabLinkStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string | null;
}
