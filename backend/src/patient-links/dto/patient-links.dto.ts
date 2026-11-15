import { Transform } from 'class-transformer';
import {
  Equals,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RevokeAppLinkDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class AcceptClaimDto {
  @IsIn(['self', 'child', 'parent', 'spouse', 'other'])
  relation: 'self' | 'child' | 'parent' | 'spouse' | 'other';

  @IsOptional()
  @IsUUID()
  profileId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  newProfileName?: string;

  @Equals(true)
  confirm: true;
}
