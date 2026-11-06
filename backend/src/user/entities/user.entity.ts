import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ProviderEnum } from 'src/auth/enum/ProviderEnum';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { AccountStatus } from '../enum/AccountStatus';

@Entity({ name: 'users' })
@Index(['status'])
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'uuid' })
  uuid: string;

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true })
  name?: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ name: 'password', type: 'varchar', length: 255, nullable: true })
  password?: string;

  @Column({ name: 'password_reset_token', type: 'varchar', nullable: true })
  passwordResetToken?: string | null;

  @Column({
    name: 'password_reset_expires',
    type: 'timestamptz',
    nullable: true,
  })
  passwordResetExpires?: Date | null;

  /** Pending email verification: sha256 of the emailed token. */
  @Column({
    name: 'email_verification_token',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  emailVerificationToken?: string | null;

  @Column({
    name: 'email_verification_expires',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerificationExpires?: Date | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt?: Date | null;

  /**
   * Until when an unverified password account may still use the system
   * (`EmailVerifiedGuard`). New accounts: now (verify first). Accounts that
   * existed before verification was enforced: set to +7 days on their first
   * request. Null = not scheduled yet; cleared once verified.
   */
  @Column({
    name: 'email_verification_due_at',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerificationDueAt?: Date | null;

  @Column({
    name: 'provider',
    type: 'enum',
    enum: ProviderEnum,
    default: ProviderEnum.LOCAL,
  })
  provider: ProviderEnum;

  /**
   * @deprecated Use session-specific refresh tokens instead.
   * Kept for backward compatibility during migration period.
   */
  @Column({ name: 'refresh_token', type: 'varchar', nullable: true })
  refreshToken?: string | null;

  /**
   * Global role — only super_admin has a value here.
   * Normal users have null (their access is determined by organization_admins / user_locations).
   */
  @Column({
    name: 'global_role',
    type: 'enum',
    enum: GlobalRole,
    nullable: true,
    default: null,
  })
  globalRole: GlobalRole | null;

  /**
   * Account status for lifecycle management.
   * Controls what actions the user can perform.
   */
  @Column({
    name: 'status',
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.ACTIVE,
  })
  status: AccountStatus;

  /**
   * Last accessed organization — for UX continuity.
   */
  @Column({
    name: 'last_accessed_organization_id',
    type: 'uuid',
    nullable: true,
  })
  lastAccessedOrganizationId?: string | null;

  /**
   * Last accessed location — for UX continuity.
   */
  @Column({ name: 'last_accessed_location_id', type: 'uuid', nullable: true })
  lastAccessedLocationId?: string | null;

  /**
   * Timestamp when account was soft-deleted.
   */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  /**
   * Timestamp when account was suspended.
   */
  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt?: Date | null;

  /**
   * Reason for account suspension.
   */
  @Column({ name: 'suspension_reason', type: 'text', nullable: true })
  suspensionReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
