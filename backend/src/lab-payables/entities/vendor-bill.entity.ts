import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { PaisaColumn } from 'src/billing/common/paisa-column';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Lab } from 'src/labs/entities/lab.entity';
import { BillLineKind, VendorBillStatus } from '../enums/payables.enums';

/**
 * What the clinic owes a lab (lab ERD §6b). One draft per lab order is made
 * at lab accept from the items' frozen lab costs; nothing reaches the ledger
 * until approval (Lab Cost / Lab Payable). `paid_paisa` / `balance_paisa`
 * are cached and recomputed in every allocation's transaction. Never
 * deleted: a wrong bill is voided.
 */
@Entity({ name: 'vendor_bills' })
@Index('uq_vendor_bills_no', ['organizationId', 'billNo'], { unique: true })
@Index(
  'uq_vendor_bills_vendor_invoice',
  ['organizationId', 'labId', 'vendorInvoiceNo'],
  {
    unique: true,
    where: `"vendor_invoice_no" IS NOT NULL AND "status" <> 'void'`,
  },
)
@Index('idx_vendor_bills_lab_status_due', ['labId', 'status', 'dueOn'])
@Index('idx_vendor_bills_order', ['labOrderId'])
/** At most one open draft per order: re-syncs land on it. */
@Index('uq_vendor_bills_order_draft', ['labOrderId'], {
  unique: true,
  where: `"status" = 'draft' AND "lab_order_id" IS NOT NULL`,
})
@Check(
  'chk_vendor_bills_paisa',
  `"subtotal_paisa" >= 0 AND "tax_paisa" >= 0 AND "total_paisa" = "subtotal_paisa" + "tax_paisa" AND "paid_paisa" >= 0 AND "balance_paisa" >= 0`,
)
export class VendorBill {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => Lab, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId: string;

  /** The order the draft was made for; null for a manual bill. */
  @Column({ name: 'lab_order_id', type: 'uuid', nullable: true })
  labOrderId: string | null;

  @Column({ name: 'bill_no', type: 'varchar', length: 30 })
  billNo: string;

  /** The lab's own invoice number, entered at approval. */
  @Column({
    name: 'vendor_invoice_no',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  vendorInvoiceNo: string | null;

  @Column({ name: 'statement_id', type: 'uuid', nullable: true })
  statementId: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: VendorBillStatus,
    default: VendorBillStatus.DRAFT,
  })
  status: VendorBillStatus;

  @Column({ name: 'bill_date', type: 'date' })
  billDate: string;

  @Column({ name: 'due_on', type: 'date', nullable: true })
  dueOn: string | null;

  @PaisaColumn('subtotal_paisa')
  subtotalPaisa: number;

  /** Basis points of the subtotal, default 0 until the accountant sets the rate. */
  @Column({ name: 'tax_bp', type: 'int', default: 0 })
  taxBp: number;

  @PaisaColumn('tax_paisa')
  taxPaisa: number;

  @PaisaColumn('total_paisa')
  totalPaisa: number;

  @PaisaColumn('paid_paisa')
  paidPaisa: number;

  @PaisaColumn('balance_paisa')
  balancePaisa: number;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'PKR' })
  currency: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  /** The Lab Cost / Lab Payable journal. */
  @Column({ name: 'journal_id', type: 'uuid', nullable: true })
  journalId: string | null;

  @Column({ name: 'voided_by', type: 'uuid', nullable: true })
  voidedBy: string | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;

  @OneToMany(() => VendorBillLine, (l) => l.bill)
  lines: VendorBillLine[];
}

/**
 * One cost on a bill: an item's lab cost, an approved extra charge or a
 * remake. Lines of a draft follow the order (re-synced); after approval
 * they are frozen with the bill.
 */
@Entity({ name: 'vendor_bill_lines' })
@Index('idx_vendor_bill_lines_bill', ['vendorBillId'])
@Index('idx_vendor_bill_lines_item', ['orderItemId'])
@Index('idx_vendor_bill_lines_charge', ['chargeRequestId'])
@Check(
  'chk_vendor_bill_lines_paisa',
  `"quantity" > 0 AND "unit_cost_paisa" >= 0 AND "line_total_paisa" >= 0`,
)
export class VendorBillLine {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => VendorBill, (b) => b.lines, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vendor_bill_id' })
  bill: VendorBill;

  @Column({ name: 'vendor_bill_id', type: 'uuid' })
  vendorBillId: string;

  @Column({ name: 'line_kind', type: 'enum', enum: BillLineKind })
  lineKind: BillLineKind;

  @Column({ name: 'lab_order_id', type: 'uuid', nullable: true })
  labOrderId: string | null;

  @Column({ name: 'order_item_id', type: 'uuid', nullable: true })
  orderItemId: string | null;

  @Column({ name: 'charge_request_id', type: 'uuid', nullable: true })
  chargeRequestId: string | null;

  @Column({ name: 'remake_request_id', type: 'uuid', nullable: true })
  remakeRequestId: string | null;

  @Column({ name: 'description', type: 'varchar', length: 300 })
  description: string;

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity: number;

  @PaisaColumn('unit_cost_paisa')
  unitCostPaisa: number;

  @PaisaColumn('line_total_paisa')
  lineTotalPaisa: number;

  /** Added by hand on the draft (not synced from the order). */
  @Column({ name: 'is_manual', type: 'boolean', default: false })
  isManual: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
