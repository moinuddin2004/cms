import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ProviderEnum } from 'src/auth/enum/ProviderEnum';
import { Role } from 'src/user/enum/role.enum';
import { UserLevel } from '../enum/UserLevel';
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

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ name: 'password', type: 'varchar', length: 255, nullable: true })
  password?: string;

  @Column({ name: 'password_reset_token', type: 'varchar', nullable: true })
  passwordResetToken?: string | null;

  @Column({ name: 'password_reset_expires', type: 'timestamptz', nullable: true })
  passwordResetExpires?: Date | null;

  @Column({ name: 'provider', type: 'enum', enum: ProviderEnum, default: ProviderEnum.LOCAL })
  provider: ProviderEnum;

  /**
   * @deprecated Use session-specific refresh tokens instead.
   * Kept for backward compatibility during migration period.
   */
  @Column({ name: 'refresh_token', type: 'varchar', nullable: true })
  refreshToken?: string | null;

  @Column({ name: 'role', type: 'enum', enum: Role, default: Role.ADMIN })
  role: Role;

  @Column({ name: 'level', type: 'enum', enum: UserLevel, default: UserLevel.BEGINNER })
  level: UserLevel;

  /**
   * Account status for lifecycle management.
   * Controls what actions the user can perform.
   */
  @Column({
    name: 'status',
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.ACTIVE
  })
  status: AccountStatus;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

