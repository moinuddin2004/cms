import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Prescription } from './prescription.entity';
import { PrescriptionHistoryChangeType } from '../enums/prescription-history-change-type.enum';

/**
 * Immutable audit trail — one row per change event. For CREATED rows
 * `previousData` is null; for AMENDED rows it's a full JSON snapshot of the
 * prescription (and its medicines) BEFORE the change, so you can render any
 * past version without re-fetching anything else.
 */
@Entity({ name: 'prescription_history' })
@Index(['prescriptionId', 'createdAt'])
export class PrescriptionHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prescription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column({ name: 'prescription_id', type: 'uuid' })
  prescriptionId: string;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @Column({
    name: 'change_type',
    type: 'enum',
    enum: PrescriptionHistoryChangeType,
  })
  changeType: PrescriptionHistoryChangeType;

  /** Full snapshot of the prescription + medicines before this change. */
  @Column({ name: 'previous_data', type: 'jsonb', nullable: true })
  previousData: Record<string, any> | null;

  @Column({ name: 'change_notes', type: 'text', nullable: true })
  changeNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
