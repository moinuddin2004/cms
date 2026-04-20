import { User } from 'src/user/entities/user.entity';
import { UserDto } from 'src/user/dto/user.dto';

export class AuthTokenDto {
  user: UserDto;
  accessToken: string;

  public static toDto(accessToken: string, user: User): AuthTokenDto {
    return {
      user: UserDto.toDto(user),
      accessToken,
    };
  }
}
