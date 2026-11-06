import { User } from '../entities/user.entity';

/**
 * A user as the user-management screens see it. Never the raw entity: that
 * carries the password hash and the reset / verification token hashes.
 */
export interface UserAdminView {
  uuid: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
  globalRole: string | null;
  provider: string;
  /** Signs in with a password (false = Google only). */
  hasPassword: boolean;
  emailVerifiedAt: Date | null;
  /** Unverified: until when it may still be used (null = not scheduled). */
  emailVerificationDueAt: Date | null;
  createdAt: Date;
}

export const toUserAdminView = (u: User): UserAdminView => ({
  uuid: u.uuid,
  email: u.email,
  name: u.name ?? null,
  phone: u.phone ?? null,
  avatarUrl: u.avatarUrl ?? null,
  status: u.status,
  globalRole: u.globalRole ?? null,
  provider: u.provider,
  hasPassword: !!u.password,
  emailVerifiedAt: u.emailVerifiedAt ?? null,
  emailVerificationDueAt: u.emailVerificationDueAt ?? null,
  createdAt: u.createdAt,
});
