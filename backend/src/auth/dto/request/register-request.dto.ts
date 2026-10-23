import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Self-serve signup: the owner's login plus their new clinic. */
export class RegisterRequestDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  clinicName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
