import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MedicationSource = 'prescription' | 'manual';
export type MedicationStatus = 'active' | 'paused' | 'completed' | 'stopped';
export type EndDateSource = 'parsed' | 'patient' | 'unknown';
export type MedicationMealRelation =
  | 'BEFORE_MEAL'
  | 'AFTER_MEAL'
  | 'WITH_MEAL'
  | 'EMPTY_STOMACH'
  | 'NONE';

/**
 * A medicine reminder schedule owned by a patient PROFILE (M3-01). Created
 * from a finalized prescription; deliberately no FK to clinic tables — the
 * schedule is the patient's property (docs/08 §5). `times` are wall-clock
 * "HH:mm" in the phone's timezone (A-10).
 */
@Entity({ name: 'medication_schedules' })
@Index('idx_medication_schedules_profile_status', ['profileId', 'status'])
@Index('idx_medication_schedules_profile_updated', ['profileId', 'updatedAt'])
@Index('uq_medication_schedules_profile_rx_medicine', ['profileId', 'prescriptionMedicineId'], {
  unique: true,
  where: `"prescription_medicine_id" IS NOT NULL`,
})
@Check('chk_medication_schedules_source', `"source" IN ('prescription','manual')`)
@Check(
  'chk_medication_schedules_status',
  `"status" IN ('active','paused','completed','stopped')`,
)
@Check(
  'chk_medication_schedules_end_source',
  `"end_date_source" IN ('parsed','patient','unknown')`,
)
export class MedicationSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK fk_medication_schedules_profile_id → patient_profiles(id) ON DELETE CASCADE. */
  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  @Column({ name: 'source', type: 'varchar', length: 15 })
  source: MedicationSource;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ name: 'prescription_id', type: 'uuid', nullable: true })
  prescriptionId: string | null;

  @Column({ name: 'prescription_medicine_id', type: 'uuid', nullable: true })
  prescriptionMedicineId: string | null;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'name_urdu', type: 'varchar', length: 200, nullable: true })
  nameUrdu: string | null;

  @Column({ name: 'dose_text', type: 'varchar', length: 120 })
  doseText: string;

  @Column({ name: 'times', type: 'jsonb', default: () => `'[]'` })
  times: string[];

  @Column({ name: 'meal_relation', type: 'varchar', length: 20, default: 'NONE' })
  mealRelation: MedicationMealRelation;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'end_date_source', type: 'varchar', length: 10, default: 'unknown' })
  endDateSource: EndDateSource;

  @Column({ name: 'status', type: 'varchar', length: 10, default: 'active' })
  status: MedicationStatus;

  @Column({ name: 'instructions', type: 'text', nullable: true })
  instructions: string | null;

  @Column({ name: 'instructions_urdu', type: 'text', nullable: true })
  instructionsUrdu: string | null;

  /** True once the patient changed times / end date / status; amendments then keep those. */
  @Column({ name: 'patient_edited', type: 'boolean', default: false })
  patientEdited: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
