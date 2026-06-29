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

/**
 * The real record of a patient actually showing up — created only when an
 * appointment reaches a real-arrival state (check-in / walk-in / complete).
 * Exactly one encounter per appointment (enforced by the unique appointment_id).
 *
 * NOTE: distinct from `PatientVisit` (table `patient_visits`), which is a
 * patient↔location *aggregate* (visit counts, total spent) and is left untouched.
 */
@Entity({ name: 'patient_encounters' })
@Unique(['appointmentId'])
@Index(['organizationId'])
@Index(['locationId'])
@Index(['patientId'])
@Index(['encounterDate'])
export class PatientEncounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── Source appointment (one encounter per appointment) ───────
  @ManyToOne(() => Appointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id', type: 'uuid' })
  appointmentId: string;

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

  // ─── Audit ────────────────────────────────────────────────────
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ─── Relations ────────────────────────────────────────────────
  @OneToMany(() => Treatment, (t) => t.encounter)
  treatments: Treatment[];
}
