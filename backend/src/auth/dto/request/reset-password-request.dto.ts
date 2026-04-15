import { IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordRequestDto {
    @IsNotEmpty()
    token: string;

    @MinLength(6)
    newPassword: string;
}
