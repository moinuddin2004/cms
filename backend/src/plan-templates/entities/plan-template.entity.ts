import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { moneyTransformer } from 'src/billing/common/money-column';
import { DiscountKind } from 'src/billing/enums/billing.enums';
import { PlanTemplateCategory } from '../enums/plan-template-category.enum';

/**
 * One service of a template; becomes a plan item when the template is used.
 * No fee here — it always comes from the service catalog, so a template never
 * goes stale when the clinic changes a price.
 */
export interface PlanTemplateItem {
  /** Catalog service; null only on predefined steps nobody has linked yet. */
  serviceId: string | null;
  /** The service's name when saved (or the predefined step's name). */
  procedureName: string;
  estimatedSessions: number;
  notes: string | null;
}

/**
 * A predefined treatment plan the doctor can pick for a patient — e.g. Root
 * Canal Treatment with its usual steps. Using it copies the procedures into
 * the patient's own plan, where they can still be edited.
 *
 * NOT to be confused with `prescription_presets` (prescriptions module),
 * which are ready-made sets of MEDICINES for a prescription.
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

  /** Discount every plan made from this template starts with (optional). */
  @Column({
    name: 'discount_kind',
    type: 'enum',
    enum: DiscountKind,
    enumName: 'plan_discount_kind_enum',
    nullable: true,
  })
  discountKind: DiscountKind | null;

  /** Percent (0–100) or rupees, by `discountKind`. */
  @Column({
    name: 'discount_value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: moneyTransformer,
  })
  discountValue: number | null;

  /** Inactive templates are hidden from the picker but kept. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
