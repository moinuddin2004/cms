import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { LabInvoiceLine } from 'src/lab-billing/entities/lab-invoice.entity';
import { Charge } from '../../entities/charge.entity';
import { MinorColumn } from '../../common/minor-column';
import { CommissionSourceType } from '../commission.enums';
import { CommissionSettlement } from './commission-settlement.entity';

/**
 * Append-only commission ledger (signed minor units). For each charge,
 * SUM(amount_minor) always equals the commission target for what has been
 * collected on it; every change inserts only the difference. Amounts are
 * never updated and rows are never deleted (a trigger enforces it); only
 * `settlement_id` is set once, by settlement.
 *
 * An entry earns on a billing v2 charge OR on a lab invoice line (lab ERD
 * §6c, lab work billed in `lab_invoice_lines`) — exactly one of the two, so
 * settlements and payroll see both kinds through the same table.
 */
@Entity({ name: 'commission_entries' })
@Check(
  'chk_commission_entries_target',
  `("charge_id" IS NULL) <> ("lab_invoice_line_id" IS NULL)`,
)
@Index('uq_commission_entries_source', ['sourceType', 'sourceId', 'chargeId'], {
  unique: true,
})
@Index(
  'uq_commission_entries_lab_source',
  ['sourceType', 'sourceId', 'labInvoiceLineId'],
  { unique: true, where: `"lab_invoice_line_id" IS NOT NULL` },
)
@Index('idx_commission_entries_lab_line', ['labInvoiceLineId'])
@Index('idx_commission_entries_assignment', ['assignmentId', 'createdAt'])
@Index('idx_commission_entries_unsettled', ['assignmentId'], {
  where: `"settlement_id" IS NULL`,
})
@Index('idx_commission_entries_charge', ['chargeId'])
export class CommissionEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => EmployeeOrgLocationAssignment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: EmployeeOrgLocationAssignment;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @ManyToOne(() => Charge, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'charge_id' })
  charge: Charge | null;

  @Column({ name: 'charge_id', type: 'uuid', nullable: true })
  chargeId: string | null;

  @ManyToOne(() => LabInvoiceLine, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'lab_invoice_line_id' })
  labInvoiceLine: LabInvoiceLine | null;

  @Column({ name: 'lab_invoice_line_id', type: 'uuid', nullable: true })
  labInvoiceLineId: string | null;

  @Column({ name: 'source_type', type: 'enum', enum: CommissionSourceType })
  sourceType: CommissionSourceType;

  /** The payment (new money) or the operation id that caused the entry. */
  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  /** Collected on the charge (capped at net) when the entry was written. */
  @MinorColumn('base_minor')
  baseMinor: number;

  @Column({ name: 'rate_bps', type: 'int', nullable: true })
  rateBps: number | null;

  /** Signed: negative reverses earlier commission. */
  @MinorColumn('amount_minor')
  amountMinor: number;

  @ManyToOne(() => CommissionSettlement, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'settlement_id' })
  settlement: CommissionSettlement | null;

  @Column({ name: 'settlement_id', type: 'uuid', nullable: true })
  settlementId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** Insert shape of an entry: columns only, no relation objects. */
export type CommissionEntryRow = Omit<
  Partial<CommissionEntry>,
  'assignment' | 'charge' | 'labInvoiceLine' | 'settlement'
>;
