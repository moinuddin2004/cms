import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { PatientEncounter } from 'src/encounters/entities/patient-encounter.entity';
import { PrescriptionTemplate } from './prescription-template.entity';
import { TreatmentPlanTemplate } from './treatment-plan-template.entity';
import { PrescriptionMedicine } from './prescription-medicine.entity';
import { PrescriptionStatus } from '../enums/prescription-status.enum';

/**
 * A concrete prescription issued to a patient — the medical record the doctor
 * signs and shares. Coexists with the legacy `patient_prescriptions` table
 * (different table name, different controller path) so existing rows keep
 * working while consumers migrate to this richer schema.
 *
 * Lifecycle:
 *   DRAFT      — being edited, not visible to patient
 *   FINALIZED  — signed; PDF generated; can be printed / shared
 *   AMENDED    — was FINALIZED then edited; `version` increments each time;
 *                each amendment is captured in PrescriptionHistory.previousData
 *
 * Medicines are eager-loaded — every consumer (preview, PDF, list cell)
 * needs them.
 */
@Entity({ name: 'prescriptions' })
@Index(['organizationId', 'locationId'])
@Index(['patientId'])
@Index(['appointmentId'])
@Index(['encounterId'])
@Index(['doctorId'])
@Index(['prescriptionNumber'], { unique: true })
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Sequential per org — "RX-2026-00001". */
  @Column({ name: 'prescription_number', type: 'varchar', length: 30, unique: true })
  prescriptionNumber: string;

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

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Appointment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  /** The consultation this was written in (walk-ins have no appointment). */
  @ManyToOne(() => PatientEncounter, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter: PatientEncounter | null;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId: string | null;

  @ManyToOne(() => Employee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Employee | null;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  @ManyToOne(() => PrescriptionTemplate, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'prescription_template_id' })
  prescriptionTemplate: PrescriptionTemplate | null;

  @Column({ name: 'prescription_template_id', type: 'uuid', nullable: true })
  prescriptionTemplateId: string | null;

  @ManyToOne(() => TreatmentPlanTemplate, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'treatment_plan_template_id' })
  treatmentPlanTemplate: TreatmentPlanTemplate | null;

  @Column({ name: 'treatment_plan_template_id', type: 'uuid', nullable: true })
  treatmentPlanTemplateId: string | null;

  @Column({ name: 'diagnosis', type: 'text', nullable: true })
  diagnosis: string | null;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string | null;

  @Column({ name: 'further_plan', type: 'text', nullable: true })
  furtherPlan: string | null;

  @Column({ name: 'instructions_english', type: 'text', nullable: true })
  instructionsEnglish: string | null;

  @Column({ name: 'instructions_urdu', type: 'text', nullable: true })
  instructionsUrdu: string | null;

  /** { bp, pulse, temperature, spo2, weight, height, bmi, respiratoryRate }. */
  @Column({ name: 'vitals', type: 'jsonb', nullable: true })
  vitals: Record<string, any> | null;

  @Column({ name: 'signature_image_url', type: 'text', nullable: true })
  signatureImageUrl: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PrescriptionStatus,
    default: PrescriptionStatus.DRAFT,
  })
  status: PrescriptionStatus;

  /** Cached generated PDF URL — cleared when the record is amended. */
  @Column({ name: 'pdf_url', type: 'text', nullable: true })
  pdfUrl: string | null;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => PrescriptionMedicine, (m) => m.prescription, {
    cascade: true,
    eager: true,
  })
  medicines: PrescriptionMedicine[];
}
