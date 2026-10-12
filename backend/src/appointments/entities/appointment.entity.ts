import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Exclusion,
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
// The database itself refuses two live bookings for one doctor at once
// (needs the btree_gist extension, created before synchronize in app.module).
// Violations surface as Postgres 23P01 and are mapped to 409.
@Exclusion(
  'no_doctor_overlap',
  `USING gist ("doctor_id" WITH =, tstzrange("start_time", "end_time", '[)') WITH &&) WHERE ("status" NOT IN ('cancelled', 'no_show'))`,
)
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

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Employee;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId: string;

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

  /** Free-text reason the patient is visiting (shown in the queue row). */
  @Column({ name: 'reason_for_visit', type: 'text', nullable: true })
  reasonForVisit: string | null;

  // ─── Flags ────────────────────────────────────────────────────

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

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'no_show_at', type: 'timestamptz', nullable: true })
  noShowAt: Date | null;

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
