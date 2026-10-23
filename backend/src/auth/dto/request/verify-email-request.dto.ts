import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyEmailRequestDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  token: string;
}
