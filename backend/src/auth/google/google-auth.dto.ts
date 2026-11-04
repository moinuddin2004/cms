import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** The ID token from Google Identity Services ("Sign in with Google"). */
export class GoogleCredentialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  credential: string;
}

export class GoogleSignInDto extends GoogleCredentialDto {
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

/** New clinic with a Google login as its owner. */
export class GoogleRegisterDto extends GoogleCredentialDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  clinicName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

/** Ask to join a clinic that takes requests from the Google account's domain. */
export class GoogleJoinRequestDto extends GoogleCredentialDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
