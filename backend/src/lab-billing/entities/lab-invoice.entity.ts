import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { MinorColumn } from 'src/billing/common/minor-column';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { LabOrder } from 'src/lab-orders/entities/lab-order.entity';
import { LabOrderItem } from 'src/lab-orders/entities/lab-order-item.entity';
import { OrderChargeRequest } from 'src/lab-orders/entities/order-records.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import {
  LabInvoiceLineKind,
  LabInvoiceStatus,
} from '../enums/lab-billing.enums';

/**
 * A patient invoice for lab work (lab ERD §6a). A `draft` is an estimate
 * (no number, editable, owes nothing); issuing numbers it and freezes the
 * lines. The cached money columns and `status` are written only by
 * `LabBillingTotals` (billing v2 pattern 6.12): recomputed from source rows,
 * never incremented. Never deleted — voided.
 *
 * Inv. 4: total = Σ lines; balance = total − credited − active allocations ≥ 0.
 */
@Entity({ name: 'lab_invoices' })
@Unique('uq_lab_invoices_org_no', ['organizationId', 'invoiceNo'])
@Check(
  'chk_lab_invoices_math',
  `"total_minor" = "subtotal_minor" - "discount_minor" + "tax_minor" AND "balance_minor" >= 0 AND "paid_minor" >= 0 AND "credited_minor" >= 0`,
)
@Index('idx_lab_invoices_patient', ['organizationId', 'patientId'])
@Index('idx_lab_invoices_order', ['orderId'])
@Index('idx_lab_invoices_status', ['organizationId', 'status'])
export class LabInvoice {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  /** Null while a draft (estimate). */
  @Column({ name: 'invoice_no', type: 'varchar', length: 30, nullable: true })
  invoiceNo: string | null;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  /** The lab order the lines came from (null for a manual-only invoice). */
  @ManyToOne(() => LabOrder, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: LabOrder | null;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: LabInvoiceStatus,
    default: LabInvoiceStatus.DRAFT,
  })
  status: LabInvoiceStatus;

  @Column({ name: 'issued_on', type: 'date', nullable: true })
  issuedOn: string | null;

  @Column({ name: 'due_on', type: 'date', nullable: true })
  dueOn: string | null;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'PKR' })
  currency: string;

  @MinorColumn('subtotal_minor')
  subtotalMinor: number;

  @MinorColumn('discount_minor')
  discountMinor: number;

  @MinorColumn('tax_minor')
  taxMinor: number;

  @MinorColumn('total_minor')
  totalMinor: number;

  /** Σ credit notes (cached). */
  @MinorColumn('credited_minor')
  creditedMinor: number;

  /** Σ active allocations (cached). */
  @MinorColumn('paid_minor')
  paidMinor: number;

  @MinorColumn('balance_minor')
  balanceMinor: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'issued_by', type: 'uuid', nullable: true })
  issuedBy: string | null;

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issuedAt: Date | null;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string | null;

  @Column({ name: 'voided_by', type: 'uuid', nullable: true })
  voidedBy: string | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @OneToMany(() => LabInvoiceLine, (l) => l.invoice)
  lines: LabInvoiceLine[];

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}

/**
 * One billed thing. Money per line, half-up: net = qty × unit − discount;
 * tax = net × tax_rate_bp / 10 000; total = net + tax. A lab order item
 * (or charge request) sits on at most one non-void line (partial unique
 * indexes), so it is never billed twice; voiding the invoice frees it.
 */
@Entity({ name: 'lab_invoice_lines' })
@Unique('uq_lab_invoice_lines_no', ['invoiceId', 'lineNo'])
@Check(
  'chk_lab_invoice_lines_math',
  `"quantity" > 0 AND "unit_price_minor" >= 0 AND "discount_minor" >= 0 AND "discount_minor" <= "quantity" * "unit_price_minor" AND "tax_rate_bp" BETWEEN 0 AND 10000 AND "tax_minor" >= 0 AND "line_total_minor" = "quantity" * "unit_price_minor" - "discount_minor" + "tax_minor"`,
)
@Index('uq_lab_invoice_lines_item', ['labOrderItemId'], {
  unique: true,
  where: `"lab_order_item_id" IS NOT NULL AND NOT "is_void"`,
})
@Index('uq_lab_invoice_lines_charge', ['orderChargeRequestId'], {
  unique: true,
  where: `"order_charge_request_id" IS NOT NULL AND NOT "is_void"`,
})
export class LabInvoiceLine {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => LabInvoice, (i) => i.lines, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: LabInvoice;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ name: 'line_no', type: 'int' })
  lineNo: number;

  @Column({
    name: 'line_kind',
    type: 'enum',
    enum: LabInvoiceLineKind,
  })
  lineKind: LabInvoiceLineKind;

  @ManyToOne(() => LabOrderItem, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_order_item_id' })
  labOrderItem: LabOrderItem | null;

  @Column({ name: 'lab_order_item_id', type: 'uuid', nullable: true })
  labOrderItemId: string | null;

  @ManyToOne(() => OrderChargeRequest, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_charge_request_id' })
  orderChargeRequest: OrderChargeRequest | null;

  @Column({ name: 'order_charge_request_id', type: 'uuid', nullable: true })
  orderChargeRequestId: string | null;

  /** Billing `services.id` (from the item's frozen mapping). */
  @Column({ name: 'clinic_treatment_id', type: 'uuid', nullable: true })
  clinicTreatmentId: string | null;

  /** The doctor credited for the work (employee) — commission input. */
  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  /**
   * Commission snapshot taken at issue (like billing v2's charges): the
   * doctor's assignment at the invoice's location, the plan in force that
   * day and the resolved rate or fixed amount. Null = earns no commission.
   */
  @Column({ name: 'performing_assignment_id', type: 'uuid', nullable: true })
  performingAssignmentId: string | null;

  @Column({ name: 'commission_plan_id', type: 'uuid', nullable: true })
  commissionPlanId: string | null;

  @Column({ name: 'commission_rate_bps', type: 'int', nullable: true })
  commissionRateBps: number | null;

  @MinorColumn('commission_fixed_minor', { nullable: true })
  commissionFixedMinor: number | null;

  @Column({ name: 'description', type: 'varchar', length: 200 })
  description: string;

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity: number;

  @MinorColumn('unit_price_minor')
  unitPriceMinor: number;

  @MinorColumn('discount_minor')
  discountMinor: number;

  @Column({ name: 'tax_rate_bp', type: 'int', default: 0 })
  taxRateBp: number;

  @MinorColumn('tax_minor')
  taxMinor: number;

  @MinorColumn('line_total_minor')
  lineTotalMinor: number;

  /** Copied from the invoice on void, for the partial unique indexes. */
  @Column({ name: 'is_void', type: 'boolean', default: false })
  isVoid: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
