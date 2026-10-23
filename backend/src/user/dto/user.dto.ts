import { User } from '../entities/user.entity';

export class UserDto {
  userUuid: string;
  email: string;
  name: string;
  globalRole: string | null;
  avatarUrl?: string;
  phone?: string;
  /** A self-signup that hasn't clicked the verification link yet. */
  emailVerificationPending: boolean;

  public static toDto(user: User): UserDto {
    return {
      userUuid: user.uuid,
      email: user.email,
      name: user.name || '',
      globalRole: user.globalRole || null,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      emailVerificationPending: !!user.emailVerificationToken,
    };
  }
}
