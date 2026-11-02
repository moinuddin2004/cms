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
import { VisibleIf } from 'src/access/visible-if/visible-if';
import { moneyTransformer } from 'src/billing/common/money-column';
import { DiscountKind } from 'src/billing/enums/billing.enums';
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
  @VisibleIf('patients.price.view')
  @Column({
    name: 'estimated_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  estimatedCost: number | null;

  @VisibleIf('patients.price.view')
  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  discountAmount: number;

  @VisibleIf('patients.price.view')
  @Column({
    name: 'final_estimated_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  finalEstimatedCost: number | null;

  // ─── Status & Timeline ──────────────────────────────────
  @Column({
    name: 'status',
    type: 'enum',
    enum: TreatmentPlanStatus,
    default: TreatmentPlanStatus.DRAFT,
  })
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

  // ─── Package pricing ────────────────────────────────────
  /** The visit it was made in; completing that visit bills the plan. */
  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId: string | null;

  /** Template the plan started from (its services + discount were copied). */
  @Column({ name: 'plan_template_id', type: 'uuid', nullable: true })
  planTemplateId: string | null;

  /** Plan-level discount; the amount is in `discountAmount`. */
  @VisibleIf('patients.price.view')
  @Column({
    name: 'discount_kind',
    type: 'enum',
    enum: DiscountKind,
    enumName: 'plan_discount_kind_enum',
    nullable: true,
  })
  discountKind: DiscountKind | null;

  /** Percent (0–100) or rupees, by `discountKind`. */
  @VisibleIf('patients.price.view')
  @Column({
    name: 'discount_value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: moneyTransformer,
  })
  discountValue: number | null;

  /**
   * The one invoice for the whole plan, issued at the first session. Once
   * set, the plan's services and prices are locked.
   */
  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;

  // ─── Relations ──────────────────────────────────────────
  @OneToMany(() => TreatmentPlanItem, (item) => item.plan)
  items: TreatmentPlanItem[];
}
