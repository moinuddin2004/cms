import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum JoinRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Someone who signed in with Google from a clinic's Workspace domain and
 * asked to join it. Gives no access by itself: an owner/manager approves it,
 * which creates the employee at their location with the role they pick.
 */
@Entity({ name: 'clinic_join_requests' })
@Index(['organizationId', 'status'])
@Index(['userId'])
export class ClinicJoinRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'email', type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'phone', type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'message', type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: JoinRequestStatus,
    default: JoinRequestStatus.PENDING,
  })
  status: JoinRequestStatus;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({
    name: 'decision_note',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  decisionNote: string | null;

  /** The employee created on approval. */
  @Column({ name: 'employee_id', type: 'uuid', nullable: true })
  employeeId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
