import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanTemplateCategory } from '../enums/plan-template-category.enum';

/** One procedure of a template; becomes a plan item when the template is used. */
export interface PlanTemplateItem {
  procedureName: string;
  estimatedSessions: number;
  /** The clinic's usual fee; null until the clinic sets it. */
  estimatedCost: number | null;
  notes: string | null;
}

/**
 * A predefined treatment plan the doctor can pick for a patient — e.g. Root
 * Canal Treatment with its usual steps. Using it copies the procedures into
 * the patient's own plan, where they can still be edited.
 *
 * NOT to be confused with `treatment_plan_templates` (prescriptions module),
 * which despite its name is a set of MEDICINES for a prescription — the UI
 * calls those "Prescription Presets".
 */
@Entity({ name: 'plan_templates' })
@Index(['organizationId'])
export class PlanTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({
    name: 'category',
    type: 'enum',
    enum: PlanTemplateCategory,
    default: PlanTemplateCategory.GENERAL,
  })
  category: PlanTemplateCategory;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'items', type: 'jsonb', default: () => `'[]'` })
  items: PlanTemplateItem[];

  /** Inactive templates are hidden from the picker but kept. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
