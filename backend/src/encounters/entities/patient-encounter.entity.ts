import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Patient } from 'src/patients/entities/patient.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Treatment } from 'src/treatments/entities/treatment.entity';
import { QueueEntry } from 'src/queue/entities/queue-entry.entity';

/**
 * The clinical record of a consultation — created when the doctor starts the
 * consultation on a queue entry (booked or walk-in). Exactly one encounter per
 * queue entry (unique queue_entry_id); `appointment_id` is set for booked
 * visits and NULL for walk-ins.
 *
 * NOTE: distinct from `PatientVisit` (table `patient_visits`), which is a
 * patient↔location *aggregate* (visit counts, total spent) and is left untouched.
 */
@Entity({ name: 'patient_encounters' })
@Unique(['queueEntryId'])
@Index(['appointmentId'])
@Index(['organizationId'])
@Index(['locationId'])
@Index(['patientId'])
@Index(['encounterDate'])
export class PatientEncounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── Source queue entry (one encounter per entry) ─────────────
  @ManyToOne(() => QueueEntry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'queue_entry_id' })
  queueEntry: QueueEntry;

  @Column({ name: 'queue_entry_id', type: 'uuid' })
  queueEntryId: string;

  // ─── Booked appointment, if any (NULL for walk-ins) ───────────
  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  // ─── Patient (denormalized for fast lookup) ───────────────────
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  // ─── Tenancy ──────────────────────────────────────────────────
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

  // ─── Details ──────────────────────────────────────────────────
  @Column({ name: 'encounter_date', type: 'timestamptz' })
  encounterDate: Date;

  /** Why they actually came — may differ from the appointment's reason. */
  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  // ─── Clinical notes (the doctor's record of this visit) ───────
  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string | null;

  @Column({ name: 'examination', type: 'text', nullable: true })
  examination: string | null;

  @Column({ name: 'diagnosis', type: 'text', nullable: true })
  diagnosis: string | null;

  /** Advice / instructions given to the patient. */
  @Column({ name: 'advice', type: 'text', nullable: true })
  advice: string | null;

  /** 'YYYY-MM-DD' — when the doctor wants to see the patient again. */
  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: string | null;

  // ─── Audit ────────────────────────────────────────────────────
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ─── Relations ────────────────────────────────────────────────
  @OneToMany(() => Treatment, (t) => t.encounter)
  treatments: Treatment[];
}
