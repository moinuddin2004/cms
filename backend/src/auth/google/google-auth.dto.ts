import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
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

/**
 * Ask to join a clinic: through its invite link (`inviteToken`), or one
 * that takes requests from the Google account's Workspace domain.
 */
export class GoogleJoinRequestDto extends GoogleCredentialDto {
  @ValidateIf((o: GoogleJoinRequestDto) => !o.inviteToken)
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,64}$/)
  inviteToken?: string;

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
