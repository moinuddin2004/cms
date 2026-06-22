import { IsEmail, IsString, IsOptional, MinLength, MaxLength, IsIn, IsEnum } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsIn(['super_admin', 'owner'])
  type: string;
}
