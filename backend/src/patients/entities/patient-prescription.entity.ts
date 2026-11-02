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
import { Patient } from './patient.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';

@Entity({ name: 'patient_prescriptions' })
@Index(['organizationId', 'prescriptionNumber'], { unique: true })
@Index(['patientId'])
@Index(['organizationId'])
@Index(['prescribedBy'])
@Index(['prescriptionDate'])
export class PatientPrescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (p) => p.prescriptions, { onDelete: 'CASCADE' })
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

  @Column({ name: 'prescribed_by', type: 'uuid' })
  prescribedBy: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'prescription_number', type: 'varchar', length: 20 })
  prescriptionNumber: string;

  @Column({ name: 'prescription_date', type: 'date', default: () => 'CURRENT_DATE' })
  prescriptionDate: Date;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string | null;

  @Column({ name: 'diagnosis', type: 'text', nullable: true })
  diagnosis: string | null;

  /** Array of medication objects with name, strength, dose, frequency, duration, etc. */
  @Column({ name: 'medications', type: 'jsonb', default: '[]' })
  medications: Record<string, any>[];

  @Column({ name: 'special_instructions', type: 'text', nullable: true })
  specialInstructions: string | null;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: Date | null;

  @Column({ name: 'is_printed', type: 'boolean', default: false })
  isPrinted: boolean;

  @Column({ name: 'printed_at', type: 'timestamptz', nullable: true })
  printedAt: Date | null;

  @Column({ name: 'print_count', type: 'int', default: 0 })
  printCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
