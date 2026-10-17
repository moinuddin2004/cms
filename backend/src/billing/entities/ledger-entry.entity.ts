import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MoneyColumn } from '../common/money-column';
import { LedgerEntryType } from '../enums/billing.enums';

/**
 * Append-only line of the patient statement (D18). Exactly one of
 * debit / credit is > 0. Balance sign: + patient owes, − clinic holds advance.
 */
@Entity({ name: 'ledger_entries' })
@Index('idx_ledger_patient', [
  'organizationId',
  'locationId',
  'patientId',
  'entryDate',
  'createdAt',
])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'type', type: 'enum', enum: LedgerEntryType })
  type: LedgerEntryType;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: string;

  @MoneyColumn('debit')
  debit: number;

  @MoneyColumn('credit')
  credit: number;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ name: 'refund_id', type: 'uuid', nullable: true })
  refundId: string | null;

  @Column({ name: 'invoice_revision', type: 'int', nullable: true })
  invoiceRevision: number | null;

  @Column({ name: 'description', type: 'varchar', length: 200 })
  description: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
