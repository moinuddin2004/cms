import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type DoseAction = 'taken' | 'skipped';

/** One patient decision about one due dose (M3-02). Unique per (schedule, due_at). */
@Entity({ name: 'medication_dose_events' })
@Index('uq_medication_dose_events_schedule_due', ['scheduleId', 'dueAt'], {
  unique: true,
})
@Check('chk_medication_dose_events_action', `"action" IN ('taken','skipped')`)
export class MedicationDoseEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK fk_medication_dose_events_schedule_id → medication_schedules(id) ON DELETE CASCADE. */
  @Column({ name: 'schedule_id', type: 'uuid' })
  scheduleId: string;

  @Column({ name: 'due_at', type: 'timestamptz' })
  dueAt: Date;

  @Column({ name: 'action', type: 'varchar', length: 10 })
  action: DoseAction;

  @Column({ name: 'acted_at', type: 'timestamptz' })
  actedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
