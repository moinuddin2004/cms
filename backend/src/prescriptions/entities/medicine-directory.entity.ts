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
import { Organization } from 'src/organizations/entities/organization.entity';
import { MedicineType } from '../enums/medicine-type.enum';
import { MealRelation } from '../enums/meal-relation.enum';

/**
 * The clinic's master medicine catalog. Powers the autocomplete on the
 * prescription builder — doctors type and pick a medicine, which auto-fills
 * dosage/frequency/duration/Urdu defaults defined here. Items are soft-disabled
 * via `isActive`, never hard-deleted, so old prescriptions still resolve.
 */
@Entity({ name: 'medicine_directory' })
@Index(['organizationId', 'isActive'])
@Index(['organizationId', 'name'])
export class MedicineDirectory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'generic_name', type: 'varchar', length: 200, nullable: true })
  genericName: string | null;

  @Column({ name: 'name_urdu', type: 'varchar', length: 200, nullable: true })
  nameUrdu: string | null;

  @Column({
    name: 'type',
    type: 'enum',
    enum: MedicineType,
    default: MedicineType.TABLET,
  })
  type: MedicineType;

  @Column({ name: 'strength', type: 'varchar', length: 100, nullable: true })
  strength: string | null;

  @Column({ name: 'manufacturer', type: 'varchar', length: 150, nullable: true })
  manufacturer: string | null;

  @Column({ name: 'default_dosage', type: 'varchar', length: 100, nullable: true })
  defaultDosage: string | null;

  @Column({ name: 'default_frequency', type: 'varchar', length: 100, nullable: true })
  defaultFrequency: string | null;

  @Column({ name: 'default_duration', type: 'varchar', length: 100, nullable: true })
  defaultDuration: string | null;

  @Column({
    name: 'default_meal_relation',
    type: 'enum',
    enum: MealRelation,
    default: MealRelation.NONE,
  })
  defaultMealRelation: MealRelation;

  @Column({ name: 'instructions_urdu', type: 'text', nullable: true })
  instructionsUrdu: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
