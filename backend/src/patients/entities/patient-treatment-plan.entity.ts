import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { TreatmentPlanStatus } from '../enums/treatment-plan-status.enum';
import { TreatmentPlanItem } from './treatment-plan-item.entity';

@Entity({ name: 'patient_treatment_plans' })
@Index(['organizationId', 'planNumber'], { unique: true })
@Index(['patientId'])
@Index(['organizationId'])
@Index(['status'])
@Index(['dentistId'])
export class PatientTreatmentPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (p) => p.treatmentPlans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'dentist_id', type: 'uuid' })
  dentistId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'plan_number', type: 'varchar', length: 20 })
  planNumber: string;

  @Column({ name: 'plan_name', type: 'varchar', length: 200 })
  planName: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  // ─── Financials ─────────────────────────────────────────
  @Column({ name: 'estimated_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedCost: number | null;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'final_estimated_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  finalEstimatedCost: number | null;

  // ─── Status & Timeline ──────────────────────────────────
  @Column({ name: 'status', type: 'enum', enum: TreatmentPlanStatus, default: TreatmentPlanStatus.DRAFT })
  status: TreatmentPlanStatus;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date | null;

  @Column({ name: 'expected_end_date', type: 'date', nullable: true })
  expectedEndDate: Date | null;

  @Column({ name: 'actual_end_date', type: 'date', nullable: true })
  actualEndDate: Date | null;

  // ─── Consent ────────────────────────────────────────────
  @Column({ name: 'patient_accepted', type: 'boolean', default: false })
  patientAccepted: boolean;

  @Column({ name: 'patient_accepted_at', type: 'timestamptz', nullable: true })
  patientAcceptedAt: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  // ─── Relations ──────────────────────────────────────────
  @OneToMany(() => TreatmentPlanItem, (item) => item.plan)
  items: TreatmentPlanItem[];
}
