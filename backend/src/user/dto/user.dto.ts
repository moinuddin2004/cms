import { User } from '../entities/user.entity';

export class UserDto {
  userUuid: string;
  email: string;
  name: string;
  globalRole: string | null;
  avatarUrl?: string;
  phone?: string;
  /** A password account whose email is not verified yet. */
  emailVerificationPending: boolean;
  /**
   * Pending only: until when the account may still be used unverified
   * (ISO); null = not scheduled yet. Past it, requests get EMAIL_NOT_VERIFIED.
   */
  emailVerificationDueAt: string | null;

  public static toDto(user: User): UserDto {
    return {
      userUuid: user.uuid,
      email: user.email,
      name: user.name || '',
      globalRole: user.globalRole || null,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      // Google-only accounts (no password) are verified by Google on sign-in.
      emailVerificationPending: !user.emailVerifiedAt && !!user.password,
      emailVerificationDueAt:
        !user.emailVerifiedAt && user.emailVerificationDueAt
          ? new Date(user.emailVerificationDueAt).toISOString()
          : null,
    };
  }
}
