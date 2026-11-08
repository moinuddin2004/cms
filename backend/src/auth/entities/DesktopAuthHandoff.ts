import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * One-time hand-off from the system browser to the desktop app.
 *
 * The desktop shell cannot run Google sign-in inside its webview (Google
 * blocks embedded user agents), so it opens a normal browser page. The
 * browser verifies the Google ID token, this row is created, and the browser
 * is sent to `clinic://auth/callback?code=…`. The app redeems the code for a
 * session: the code is random (never the Google token), stored hashed, valid
 * for two minutes and claimed exactly once.
 */
@Entity('desktop_auth_handoffs')
export class DesktopAuthHandoff {
  @PrimaryGeneratedColumn('uuid', { name: 'uuid' })
  uuid: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** SHA-256 of the code handed to the app (hex). The code itself is never stored. */
  @Index('uq_desktop_auth_handoffs_code_hash', { unique: true })
  @Column({ name: 'code_hash', type: 'varchar', length: 64 })
  codeHash: string;

  /** The app's `state`, echoed back in the deep link so the app can match the attempt. */
  @Column({ name: 'state', type: 'varchar', length: 128 })
  state: string;

  /** Google Workspace domain (`hd`) of the account, kept for the session log. */
  @Column({
    name: 'auth_domain',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  authDomain?: string | null;

  @Index('idx_desktop_auth_handoffs_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
