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
import { VisibleIf } from 'src/access/visible-if/visible-if';
import { PatientTreatmentPlan } from './patient-treatment-plan.entity';
import { PlanItemStatus } from '../enums/plan-item-status.enum';

@Entity({ name: 'treatment_plan_items' })
@Index(['planId'])
@Index(['status'])
@Index(['planId', 'sequenceOrder'])
export class TreatmentPlanItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PatientTreatmentPlan, (p) => p.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_id' })
  plan: PatientTreatmentPlan;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  /** Catalog service; the plan's price for it is locked in `estimatedCost`. */
  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @Column({ name: 'procedure_name', type: 'varchar', length: 200 })
  procedureName: string;

  @Column({
    name: 'procedure_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  procedureCode: string | null;

  @Column({ name: 'tooth_number', type: 'varchar', length: 10, nullable: true })
  toothNumber: string | null;

  @Column({
    name: 'tooth_surface',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  toothSurface: string | null;

  @Column({ name: 'estimated_sessions', type: 'int', default: 1 })
  estimatedSessions: number;

  @Column({ name: 'completed_sessions', type: 'int', default: 0 })
  completedSessions: number;

  @VisibleIf('patients.price.view')
  @Column({
    name: 'estimated_cost',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  estimatedCost: number | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PlanItemStatus,
    default: PlanItemStatus.PENDING,
  })
  status: PlanItemStatus;

  @Column({ name: 'sequence_order', type: 'int', default: 1 })
  sequenceOrder: number;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ name: 'clinical_notes', type: 'text', nullable: true })
  clinicalNotes: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
