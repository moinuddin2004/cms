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
import { TreatmentPlanTemplateMedicine } from './treatment-plan-template-medicine.entity';
import { PresetCategory } from '../enums/preset-category.enum';

/**
 * A predefined, reusable prescription protocol — e.g. "Root Canal Aftercare"
 * or "Scaling Post-care". Selecting one in the prescription builder pre-fills
 * the medicines, further-plan text, and bilingual instructions; the doctor
 * can still edit anything before finalizing.
 *
 * Medicines are eager-loaded because templates are short lists and the
 * builder always needs them right away.
 */
@Entity({ name: 'treatment_plan_templates' })
@Index(['organizationId', 'isActive'])
@Index(['organizationId', 'category'])
export class TreatmentPlanTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'category',
    type: 'enum',
    enum: PresetCategory,
    default: PresetCategory.GENERAL,
  })
  category: PresetCategory;

  /** Mirrors the org-level specialty system — defaults to ['general']. */
  @Column({ name: 'specialty_tags', type: 'jsonb', default: () => `'["general"]'` })
  specialtyTags: string[];

  @Column({ name: 'further_plan', type: 'text', nullable: true })
  furtherPlan: string | null;

  @Column({ name: 'instructions_english', type: 'text', nullable: true })
  instructionsEnglish: string | null;

  @Column({ name: 'instructions_urdu', type: 'text', nullable: true })
  instructionsUrdu: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(
    () => TreatmentPlanTemplateMedicine,
    (m) => m.template,
    { cascade: true, eager: true },
  )
  medicines: TreatmentPlanTemplateMedicine[];
}
