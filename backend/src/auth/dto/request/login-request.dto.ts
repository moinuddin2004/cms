import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  MinLength,
} from 'class-validator';

export class LoginRequestDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  /**
   * Checked: the session lasts 30 days.
   * Unchecked/omitted: the session lasts 1 day.
   */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
