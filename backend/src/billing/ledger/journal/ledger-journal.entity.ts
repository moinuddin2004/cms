import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { MinorColumn } from '../../common/minor-column';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';

/** What a journal records (lab ERD §6c `source_type`). */
export enum JournalSource {
  VENDOR_BILL = 'vendor_bill',
  VENDOR_PAYMENT = 'vendor_payment',
  EXPENSE = 'expense',
  INVOICE = 'invoice',
  PAYMENT = 'payment',
  CREDIT_NOTE = 'credit_note',
  REFUND = 'refund',
  /** Doctor commission accrued / reversed by a money operation. */
  COMMISSION = 'commission',
}

/**
 * Chart of accounts used by the journals. Codes, not a table: posting rules
 * live in code (lab ERD §6c "Ledger posting rules").
 */
export const ACCOUNT = {
  CASH: 'CASH',
  BANK: 'BANK',
  LAB_COST: 'LAB_COST',
  LAB_PAYABLE: 'LAB_PAYABLE',
  /** Paid to a lab before a bill was there to settle. */
  LAB_ADVANCES: 'LAB_ADVANCES',
  /** Lab work billed to patients (lab invoices). */
  PATIENT_RECEIVABLE: 'PATIENT_RECEIVABLE',
  /** Patient money not yet applied to an invoice. */
  PATIENT_ADVANCES: 'PATIENT_ADVANCES',
  LAB_REVENUE: 'LAB_REVENUE',
  TAX_PAYABLE: 'TAX_PAYABLE',
  COMMISSION_EXPENSE: 'COMMISSION_EXPENSE',
  COMMISSION_PAYABLE: 'COMMISSION_PAYABLE',
} as const;
export type AccountCode = (typeof ACCOUNT)[keyof typeof ACCOUNT];

/**
 * A balanced double-entry journal (lab ERD §6c `ledger_journals`). Billing
 * v2's `ledger_entries` is the patient statement (one-sided, rupees), so
 * the general ledger lives next to it in its own two tables. Append-only:
 * a correction is a mirror journal with `reversal_of_id`.
 */
@Entity({ name: 'ledger_journals' })
@Index('idx_ledger_journals_source', [
  'organizationId',
  'sourceType',
  'sourceId',
])
@Index('uq_ledger_journals_reversal', ['reversalOfId'], {
  unique: true,
  where: `"reversal_of_id" IS NOT NULL`,
})
export class LedgerJournal {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId: string | null;

  @Column({ name: 'entry_on', type: 'date' })
  entryOn: string;

  @Column({ name: 'source_type', type: 'enum', enum: JournalSource })
  sourceType: JournalSource;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({ name: 'reversal_of_id', type: 'uuid', nullable: true })
  reversalOfId: string | null;

  @Column({ name: 'memo', type: 'varchar', length: 200 })
  memo: string;

  /** Σ debit = Σ credit of the lines. */
  @MinorColumn('total_minor')
  totalMinor: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => LedgerJournalLine, (l) => l.journal)
  lines: LedgerJournalLine[];
}

/** One side of a journal (lab ERD §6c `ledger_entries`). Never updated or deleted. */
@Entity({ name: 'ledger_journal_lines' })
@Check(
  'chk_ledger_journal_lines_side',
  `("debit_minor" > 0 AND "credit_minor" = 0) OR ("credit_minor" > 0 AND "debit_minor" = 0)`,
)
@Index('idx_ledger_journal_lines_journal', ['journalId'])
@Index('idx_ledger_journal_lines_account', ['organizationId', 'accountCode'])
@Index('idx_ledger_journal_lines_lab', ['labId'])
export class LedgerJournalLine {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => LedgerJournal, (j) => j.lines, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'journal_id' })
  journal: LedgerJournal;

  @Column({ name: 'journal_id', type: 'uuid' })
  journalId: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId: string | null;

  @Column({ name: 'account_code', type: 'varchar', length: 40 })
  accountCode: string;

  @MinorColumn('debit_minor')
  debitMinor: number;

  @MinorColumn('credit_minor')
  creditMinor: number;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  @Column({ name: 'lab_id', type: 'uuid', nullable: true })
  labId: string | null;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  @Column({ name: 'lab_order_id', type: 'uuid', nullable: true })
  labOrderId: string | null;
}
