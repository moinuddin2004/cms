import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  VersionColumn,
} from 'typeorm';
import { PaisaColumn } from 'src/billing/common/paisa-column';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Lab } from 'src/labs/entities/lab.entity';
import {
  VendorPaymentMethod,
  VendorPaymentStatus,
} from '../enums/payables.enums';
import { VendorBill } from './vendor-bill.entity';

/**
 * Money the clinic paid a lab (lab ERD §6b). Split over approved bills by
 * allocations; an unallocated rest is an advance to the lab that a later
 * allocation can use. Never deleted: a mistake is reversed.
 */
@Entity({ name: 'vendor_payments' })
@Index('uq_vendor_payments_no', ['organizationId', 'paymentNo'], {
  unique: true,
})
@Index('idx_vendor_payments_lab', ['organizationId', 'labId', 'paidAt'])
@Check(
  'chk_vendor_payments_paisa',
  `"amount_paisa" > 0 AND "allocated_paisa" >= 0 AND "allocated_paisa" <= "amount_paisa"`,
)
export class VendorPayment {
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

  @Column({ name: 'payment_no', type: 'varchar', length: 30 })
  paymentNo: string;

  @PaisaColumn('amount_paisa')
  amountPaisa: number;

  /** Cached Σ active allocations. */
  @PaisaColumn('allocated_paisa')
  allocatedPaisa: number;

  @Column({ name: 'method', type: 'enum', enum: VendorPaymentMethod })
  method: VendorPaymentMethod;

  @Column({ name: 'reference', type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  @Column({ name: 'paid_on', type: 'date' })
  paidOn: string;

  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: VendorPaymentStatus,
    default: VendorPaymentStatus.POSTED,
  })
  status: VendorPaymentStatus;

  /** Set on a reversed payment: the mirror journal carries the reversal. */
  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true })
  reversedAt: Date | null;

  @Column({ name: 'reversed_by', type: 'uuid', nullable: true })
  reversedBy: string | null;

  @Column({ name: 'reversal_reason', type: 'text', nullable: true })
  reversalReason: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;

  @OneToMany(() => VendorPaymentAllocation, (a) => a.payment)
  allocations: VendorPaymentAllocation[];
}

/** Part of a payment settling one bill. Reversed, never deleted. */
@Entity({ name: 'vendor_payment_allocations' })
@Index('idx_vendor_payment_allocations_payment', ['vendorPaymentId'])
@Index('idx_vendor_payment_allocations_bill', ['vendorBillId'])
@Check('chk_vendor_payment_allocations_paisa', `"amount_paisa" > 0`)
export class VendorPaymentAllocation {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => VendorPayment, (p) => p.allocations, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'vendor_payment_id' })
  payment: VendorPayment;

  @Column({ name: 'vendor_payment_id', type: 'uuid' })
  vendorPaymentId: string;

  @ManyToOne(() => VendorBill, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vendor_bill_id' })
  bill: VendorBill;

  @Column({ name: 'vendor_bill_id', type: 'uuid' })
  vendorBillId: string;

  @PaisaColumn('amount_paisa')
  amountPaisa: number;

  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true })
  reversedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
