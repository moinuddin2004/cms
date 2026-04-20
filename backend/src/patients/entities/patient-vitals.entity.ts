import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';

@Entity({ name: 'patient_vitals' })
@Index(['patientId'])
@Index(['organizationId'])
@Index(['appointmentId'])
@Index(['recordedAt'])
export class PatientVitals {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (p) => p.vitals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  // ─── Vitals ─────────────────────────────────────────────
  @Column({ name: 'bp_systolic', type: 'int', nullable: true })
  bpSystolic: number | null;

  @Column({ name: 'bp_diastolic', type: 'int', nullable: true })
  bpDiastolic: number | null;

  @Column({ name: 'pulse_rate', type: 'int', nullable: true })
  pulseRate: number | null;

  @Column({ name: 'temperature', type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: number | null;

  @Column({ name: 'oxygen_saturation', type: 'int', nullable: true })
  oxygenSaturation: number | null;

  @Column({ name: 'weight_kg', type: 'decimal', precision: 5, scale: 2, nullable: true })
  weightKg: number | null;

  @Column({ name: 'height_cm', type: 'decimal', precision: 5, scale: 2, nullable: true })
  heightCm: number | null;

  @Column({ name: 'bmi', type: 'decimal', precision: 4, scale: 2, nullable: true })
  bmi: number | null;

  // ─── Critical Health Flags ──────────────────────────────
  @Column({ name: 'is_diabetic', type: 'boolean', default: false })
  isDiabetic: boolean;

  @Column({ name: 'is_hypertensive', type: 'boolean', default: false })
  isHypertensive: boolean;

  @Column({ name: 'is_pregnant', type: 'boolean', default: false })
  isPregnant: boolean;

  @Column({ name: 'is_on_blood_thinners', type: 'boolean', default: false })
  isOnBloodThinners: boolean;

  @Column({ name: 'is_on_antibiotics', type: 'boolean', default: false })
  isOnAntibiotics: boolean;

  // ─── Anesthesia ─────────────────────────────────────────
  @Column({ name: 'anesthesia_type', type: 'varchar', length: 100, nullable: true })
  anesthesiaType: string | null;

  @Column({ name: 'anesthesia_dose', type: 'varchar', length: 100, nullable: true })
  anesthesiaDose: string | null;

  @Column({ name: 'anesthesia_administered_by', type: 'uuid', nullable: true })
  anesthesiaAdministeredBy: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'NOW()' })
  recordedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
