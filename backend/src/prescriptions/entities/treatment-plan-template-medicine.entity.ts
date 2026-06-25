import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TreatmentPlanTemplate } from './treatment-plan-template.entity';
import { MedicineDirectory } from './medicine-directory.entity';
import { MealRelation } from '../enums/meal-relation.enum';

/**
 * A medicine line inside a reusable treatment-plan template.
 *
 * `medicineDirectoryId` links back to the catalog row that seeded this line —
 * but `medicineName` (and the rest) are stored DENORMALIZED so the template
 * keeps working unchanged if the directory row is renamed or disabled later.
 */
@Entity({ name: 'treatment_plan_template_medicines' })
@Index(['templateId'])
export class TreatmentPlanTemplateMedicine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TreatmentPlanTemplate, (t) => t.medicines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template: TreatmentPlanTemplate;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @ManyToOne(() => MedicineDirectory, {
    onDelete: 'SET NULL',
    nullable: true,
    eager: true,
  })
  @JoinColumn({ name: 'medicine_directory_id' })
  medicineDirectory: MedicineDirectory | null;

  @Column({ name: 'medicine_directory_id', type: 'uuid', nullable: true })
  medicineDirectoryId: string | null;

  @Column({ name: 'medicine_name', type: 'varchar', length: 200 })
  medicineName: string;

  @Column({ name: 'medicine_name_urdu', type: 'varchar', length: 200, nullable: true })
  medicineNameUrdu: string | null;

  @Column({ name: 'type', type: 'varchar', length: 30, nullable: true })
  type: string | null;

  @Column({ name: 'dosage', type: 'varchar', length: 50 })
  dosage: string;

  @Column({ name: 'frequency', type: 'varchar', length: 100 })
  frequency: string;

  /**
   * Time-of-day tags for the dose: ["morning"], ["morning","evening"], etc.
   * Allowed values: morning, afternoon, evening, night, sos.
   */
  @Column({ name: 'frequency_timing', type: 'jsonb', default: () => `'[]'` })
  frequencyTiming: string[];

  @Column({
    name: 'meal_relation',
    type: 'enum',
    enum: MealRelation,
    default: MealRelation.NONE,
  })
  mealRelation: MealRelation;

  @Column({ name: 'duration', type: 'varchar', length: 50 })
  duration: string;

  @Column({ name: 'special_instructions', type: 'text', nullable: true })
  specialInstructions: string | null;

  @Column({ name: 'special_instructions_urdu', type: 'text', nullable: true })
  specialInstructionsUrdu: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
