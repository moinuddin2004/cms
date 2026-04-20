import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { GumCondition } from '../enums/gum-condition.enum';
import { BrushingFrequency } from '../enums/brushing-frequency.enum';
import { FlossingFrequency } from '../enums/flossing-frequency.enum';

@Entity({ name: 'patient_dental_info' })
@Index(['patientId'], { unique: true })
@Index(['organizationId'])
export class PatientDentalInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Patient, (p) => p.dentalInfo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid', unique: true })
  patientId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  // ─── Last Assessment ────────────────────────────────────
  @Column({ name: 'last_dental_checkup', type: 'date', nullable: true })
  lastDentalCheckup: Date | null;

  // ─── Gum & Teeth ───────────────────────────────────────
  @Column({ name: 'teeth_condition_notes', type: 'text', nullable: true })
  teethConditionNotes: string | null;

  @Column({ name: 'gum_condition', type: 'enum', enum: GumCondition, default: GumCondition.HEALTHY })
  gumCondition: GumCondition;

  @Column({ name: 'teeth_sensitivity', type: 'boolean', default: false })
  teethSensitivity: boolean;

  @Column({ name: 'sensitivity_notes', type: 'text', nullable: true })
  sensitivityNotes: string | null;

  // ─── Habits ─────────────────────────────────────────────
  @Column({ name: 'brushing_frequency', type: 'enum', enum: BrushingFrequency, default: BrushingFrequency.UNKNOWN })
  brushingFrequency: BrushingFrequency;

  @Column({ name: 'flossing_frequency', type: 'enum', enum: FlossingFrequency, default: FlossingFrequency.UNKNOWN })
  flossingFrequency: FlossingFrequency;

  @Column({ name: 'smoking_status', type: 'boolean', default: false })
  smokingStatus: boolean;

  @Column({ name: 'tobacco_chewing', type: 'boolean', default: false })
  tobaccoChewing: boolean;

  // ─── History ────────────────────────────────────────────
  @Column({ name: 'orthodontic_history', type: 'boolean', default: false })
  orthodonticHistory: boolean;

  @Column({ name: 'orthodontic_notes', type: 'text', nullable: true })
  orthodonticNotes: string | null;

  @Column({ name: 'prosthetics_info', type: 'text', nullable: true })
  prostheticsInfo: string | null;

  @Column({ name: 'previous_extractions', type: 'text', nullable: true })
  previousExtractions: string | null;

  @Column({ name: 'previous_surgeries', type: 'text', nullable: true })
  previousSurgeries: string | null;

  // ─── Doctor Notes ───────────────────────────────────────
  @Column({ name: 'xray_notes', type: 'text', nullable: true })
  xrayNotes: string | null;

  @Column({ name: 'dentist_notes', type: 'text', nullable: true })
  dentistNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
