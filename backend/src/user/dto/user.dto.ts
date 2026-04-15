import { User } from '../entities/user.model';
import { Role } from '../enum/role.enum';

export class UserDto {
  userUuid: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string;

  public static toDto(user: User): UserDto {
    return {
      userUuid: user.uuid,
      email: user.email,
      name: user.name || '',
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  }
}
