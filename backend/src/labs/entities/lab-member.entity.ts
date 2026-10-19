import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { User } from 'src/user/entities/user.entity';
import { LabMemberRole } from '../enums/lab.enums';
import { Lab } from './lab.entity';

/**
 * A user who works at a lab. Lab-side access is resolved from these rows
 * only — a lab user holds no clinic membership, so no clinic query can ever
 * return their data (lab ERD §7).
 */
@Entity({ name: 'lab_members' })
@Unique('uq_lab_members_lab_user', ['labId', 'userId'])
@Index('idx_lab_members_user', ['userId'])
export class LabMember {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Lab, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'uuid' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'role', type: 'enum', enum: LabMemberRole })
  role: LabMemberRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}
