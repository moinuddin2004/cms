import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class StartEmailDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class VerifyEmailDto {
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;

  @IsString()
  @MaxLength(20)
  termsVersion: string;

  @IsString()
  @MaxLength(20)
  privacyVersion: string;
}
