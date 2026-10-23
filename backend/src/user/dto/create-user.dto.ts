import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsIn,
  IsUUID,
  ValidateIf,
} from 'class-validator';

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
  @IsIn(['super_admin', 'owner', 'employee'])
  type: string;

  /**
   * `type: 'employee'` only: the existing employee (of the active org) this
   * login is for. Their role per location stays what the Employee module set.
   */
  @ValidateIf((o: CreateUserDto) => o.type === 'employee')
  @IsUUID()
  employeeId?: string;
}
