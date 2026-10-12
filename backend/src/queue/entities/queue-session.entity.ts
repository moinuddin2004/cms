import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Check,
  OneToMany,
} from 'typeorm';
import { Employee } from 'src/employees/entities/employee.entity';
import { SessionStatus } from '../enums/queue.enums';
import { QueueEntry } from './queue-entry.entity';

/**
 * One doctor's queue for one service day at one location. Its row is the
 * lock every queue mutation takes first (`SELECT … FOR UPDATE`), and it holds
 * the token counter, so tokens are gap-free and never duplicated.
 */
@Entity({ name: 'queue_sessions' })
@Unique('uq_queue_session_doctor_day', [
  'organizationId',
  'locationId',
  'doctorId',
  'serviceDate',
])
@Check(`"last_token_number" >= 0`)
export class QueueSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Employee;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId: string;

  /** Location-local date of the service day ("YYYY-MM-DD"). */
  @Column({ name: 'service_date', type: 'date' })
  serviceDate: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.WAITING_FOR_DOCTOR,
  })
  status: SessionStatus;

  @Column({ name: 'last_token_number', type: 'int', default: 0 })
  lastTokenNumber: number;

  /** Doctor's token prefix, copied when the session is created ("A"). */
  @Column({ name: 'token_prefix', type: 'varchar', length: 6 })
  tokenPrefix: string;

  /** Copied from the policy when the session is created; changes only via the mode endpoint. */
  @Column({ name: 'smart_queue_enabled', type: 'boolean' })
  smartQueueEnabled: boolean;

  @Column({ name: 'last_call_reason', type: 'text', nullable: true })
  lastCallReason: string | null;

  @Column({ name: 'pause_reason', type: 'text', nullable: true })
  pauseReason: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'event_seq', type: 'bigint', default: 0 })
  eventSeq: string;

  @Column({ name: 'version', type: 'int', default: 0 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => QueueEntry, (e) => e.session)
  entries: QueueEntry[];
}
