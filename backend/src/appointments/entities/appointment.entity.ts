import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { AppointmentType } from 'src/common/enums/appointment-type.enum';
import { AppointmentStatus } from 'src/common/enums/appointment-status.enum';
import { CancelReason } from '../enums/cancel-reason.enum';

@Entity({ name: 'appointments' })
@Index(['locationId', 'startTime'])
@Index(['organizationId'])
@Index(['patientId'])
@Index(['doctorId'])
@Index(['status'])
@Index(['doctorId', 'startTime', 'endTime']) // Critical for global conflict check
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── Organization & Location ──────────────────────────────────

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  // ─── Patient ──────────────────────────────────────────────────

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  // ─── Doctor (Employee) ────────────────────────────────────────

  @ManyToOne(() => Employee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Employee | null;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  // ─── Appointment Details ──────────────────────────────────────

  @Column({
    name: 'type',
    type: 'enum',
    enum: AppointmentType,
    default: AppointmentType.CONSULTATION,
  })
  type: AppointmentType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.SCHEDULED,
  })
  status: AppointmentStatus;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({ name: 'duration_minutes', type: 'int', default: 30 })
  durationMinutes: number;

  /**
   * Daily check-in token counter value, unique per location per calendar day.
   * Assigned atomically at CHECK-IN (walk-ins get it immediately on create).
   * Booked appointments stay null until the patient arrives. Used for sorting
   * the queue and for the printable receipt the patient takes to the room.
   */
  @Column({ name: 'token_number', type: 'int', nullable: true })
  tokenNumber: number | null;

  /**
   * Location token prefix snapshotted at assignment time (e.g. "KHI"), so the
   * display token ("KHI-007") stays stable even if the location prefix changes.
   */
  @Column({ name: 'token_prefix', type: 'varchar', length: 12, nullable: true })
  tokenPrefix: string | null;

  /** Free-text reason the patient is visiting (shown in the queue row). */
  @Column({ name: 'reason_for_visit', type: 'text', nullable: true })
  reasonForVisit: string | null;

  // ─── Flags ────────────────────────────────────────────────────

  @Column({ name: 'is_walk_in', type: 'boolean', default: false })
  isWalkIn: boolean;

  @Column({ name: 'is_emergency', type: 'boolean', default: false })
  isEmergency: boolean;

  // ─── Notes & Cancellation ─────────────────────────────────────

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  /** Structured cancellation reason for analytics. */
  @Column({
    name: 'cancel_reason_code',
    type: 'enum',
    enum: CancelReason,
    nullable: true,
  })
  cancelReasonCode: CancelReason | null;

  /** Optional free-text detail accompanying the cancellation. */
  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  // ─── Lifecycle timestamps (power wait-time / consult-time analytics) ──

  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt: Date | null;

  @Column({ name: 'in_room_at', type: 'timestamptz', nullable: true })
  inRoomAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  // ─── Audit ────────────────────────────────────────────────────

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
