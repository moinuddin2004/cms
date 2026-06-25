import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Prescription } from './prescription.entity';
import { MedicineDirectory } from './medicine-directory.entity';
import { MealRelation } from '../enums/meal-relation.enum';

/**
 * A single medicine line on a prescription.
 *
 * `medicineName` and the rest are stored DENORMALIZED so a finalized
 * prescription remains a faithful self-contained record even after the
 * underlying directory entry is renamed or disabled. `medicineDirectoryId`
 * preserves the link for reporting / re-ordering / autocomplete reuse.
 */
@Entity({ name: 'prescription_medicines' })
@Index(['prescriptionId'])
export class PrescriptionMedicine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prescription, (p) => p.medicines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column({ name: 'prescription_id', type: 'uuid' })
  prescriptionId: string;

  @ManyToOne(() => MedicineDirectory, {
    onDelete: 'SET NULL',
    nullable: true,
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

  /** Time-of-day tags: ["morning"], ["morning","evening"], etc. */
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
