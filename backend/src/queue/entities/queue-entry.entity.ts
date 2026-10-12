import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  Check,
} from 'typeorm';
import { Patient } from 'src/patients/entities/patient.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { EntryStatus, PriorityClass, QueueType } from '../enums/queue.enums';
import { QueueSession } from './queue-session.entity';

/**
 * A patient's place in one doctor's queue for one day. Created only at
 * check-in (booked appointment) or walk-in registration — never at booking.
 *
 * Database-level invariants (partial unique indexes):
 * - one active entry per appointment
 * - one active entry per patient per session
 * - at most one entry with the doctor (called / in consultation) per session
 */
@Entity({ name: 'queue_entries' })
@Unique('uq_queue_entry_session_token', ['queueSessionId', 'tokenNumber'])
@Check(`"token_number" > 0`)
@Check(`("queue_type" = 'appointment') = ("appointment_id" IS NOT NULL)`)
@Check(
  `"priority_class" = 'normal' OR ("urgent_since" IS NOT NULL AND "urgent_reason" IS NOT NULL)`,
)
@Index('one_active_entry_per_appt', ['appointmentId'], {
  unique: true,
  where: `"status" IN ('waiting','called','in_consultation','on_hold','skipped')`,
})
@Index('one_active_entry_per_patient', ['queueSessionId', 'patientId'], {
  unique: true,
  where: `"status" IN ('waiting','called','in_consultation','on_hold','skipped')`,
})
@Index('one_patient_with_doctor', ['queueSessionId'], {
  unique: true,
  where: `"status" IN ('called','in_consultation')`,
})
@Index('entries_waiting', ['queueSessionId', 'sortAnchorAt'], {
  where: `"status" = 'waiting'`,
})
@Index(['organizationId', 'patientId'])
export class QueueEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => QueueSession, (s) => s.entries, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'queue_session_id' })
  session: QueueSession;

  @Column({ name: 'queue_session_id', type: 'uuid' })
  queueSessionId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  // CASCADE, not SET NULL: the queue_type check needs appointment_id for booked entries.
  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  /** Walk-in created from a too-late appointment ("Convert to walk-in"). */
  @Column({ name: 'converted_from_appt_id', type: 'uuid', nullable: true })
  convertedFromApptId: string | null;

  /** The entry this one replaced when transferred from another doctor. */
  @Column({ name: 'transferred_from_id', type: 'uuid', nullable: true })
  transferredFromId: string | null;

  @Column({ name: 'token_number', type: 'int' })
  tokenNumber: number;

  @Column({ name: 'queue_type', type: 'enum', enum: QueueType })
  queueType: QueueType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: EntryStatus,
    default: EntryStatus.WAITING,
  })
  status: EntryStatus;

  @Column({
    name: 'priority_class',
    type: 'enum',
    enum: PriorityClass,
    default: PriorityClass.NORMAL,
  })
  priorityClass: PriorityClass;

  @Column({ name: 'urgent_since', type: 'timestamptz', nullable: true })
  urgentSince: Date | null;

  @Column({ name: 'urgent_reason', type: 'text', nullable: true })
  urgentReason: string | null;

  @Column({ name: 'reason_for_visit', type: 'text', nullable: true })
  reasonForVisit: string | null;

  @Column({ name: 'checked_in_at', type: 'timestamptz' })
  checkedInAt: Date;

  /** FIFO position: checked_in_at, or rejoined_at after an END-policy rejoin. */
  @Column({ name: 'sort_anchor_at', type: 'timestamptz' })
  sortAnchorAt: Date;

  @Column({ name: 'called_at', type: 'timestamptz', nullable: true })
  calledAt: Date | null;

  @Column({
    name: 'consultation_started_at',
    type: 'timestamptz',
    nullable: true,
  })
  consultationStartedAt: Date | null;

  @Column({ name: 'hold_started_at', type: 'timestamptz', nullable: true })
  holdStartedAt: Date | null;

  @Column({
    name: 'returned_from_hold_at',
    type: 'timestamptz',
    nullable: true,
  })
  returnedFromHoldAt: Date | null;

  @Column({ name: 'skipped_at', type: 'timestamptz', nullable: true })
  skippedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'version', type: 'int', default: 0 })
  version: number;
}
