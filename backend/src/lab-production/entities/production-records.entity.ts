import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { MinorColumn } from 'src/billing/common/minor-column';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { LabOrderItem } from 'src/lab-orders/entities/lab-order-item.entity';
import { LabOrder } from 'src/lab-orders/entities/lab-order.entity';
import { LabMember } from 'src/labs/entities/lab-member.entity';
import {
  QcResult,
  RemakeReason,
  RemakeStatus,
  ResponsibleParty,
  ShipmentCondition,
  ShipmentContents,
  ShipmentDirection,
  ShipmentStatus,
} from '../enums/production.enums';
import { OrderItemStage } from './order-item-stage.entity';

/**
 * Which lab technician works on an item (lab ERD §5b). Reassigning closes
 * the open row (`unassigned_at`) and adds a new one — one open per item.
 */
@Entity({ name: 'item_assignments' })
@Index('uq_item_assignments_open', ['itemId'], {
  unique: true,
  where: '"unassigned_at" IS NULL',
})
@Index('idx_item_assignments_member', ['labMemberId', 'unassignedAt'])
export class ItemAssignment {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId: string;

  @ManyToOne(() => LabOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: LabOrderItem;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => LabMember, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_member_id' })
  labMember: LabMember;

  @Column({ name: 'lab_member_id', type: 'uuid' })
  labMemberId: string;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy: string | null;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt: Date;

  @Column({ name: 'unassigned_at', type: 'timestamptz', nullable: true })
  unassignedAt: Date | null;

  @Column({ name: 'unassigned_by', type: 'uuid', nullable: true })
  unassignedBy: string | null;
}

/**
 * A parcel between a clinic and a lab, either direction (lab ERD §5b). One
 * shipment carries items of several orders of one clinic and one lab. The
 * `qr_token` is printed on the slip; scanning it opens the receive screen.
 */
@Entity({ name: 'shipments' })
@Unique('uq_shipments_org_no', ['organizationId', 'shipmentNo'])
@Unique('uq_shipments_qr_token', ['qrToken'])
@Index('idx_shipments_lab_status', ['labId', 'status', 'dispatchedAt'])
@Index('idx_shipments_org_status', ['organizationId', 'status', 'dispatchedAt'])
export class Shipment {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId: string;

  /** `SHP-0001`, per clinic organization. */
  @Column({ name: 'shipment_no', type: 'varchar', length: 30 })
  shipmentNo: string;

  @Column({ name: 'direction', type: 'enum', enum: ShipmentDirection })
  direction: ShipmentDirection;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ShipmentStatus,
    default: ShipmentStatus.DISPATCHED,
  })
  status: ShipmentStatus;

  @Column({
    name: 'courier_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  courierName: string | null;

  @Column({
    name: 'tracking_no',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  trackingNo: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'dispatched_at', type: 'timestamptz' })
  dispatchedAt: Date;

  @Column({ name: 'dispatched_by', type: 'uuid', nullable: true })
  dispatchedBy: string | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @Column({ name: 'received_by', type: 'uuid', nullable: true })
  receivedBy: string | null;

  @Column({ name: 'lost_at', type: 'timestamptz', nullable: true })
  lostAt: Date | null;

  @Column({ name: 'lost_reason', type: 'text', nullable: true })
  lostReason: string | null;

  @Column({ name: 'qr_token', type: 'varchar', length: 64 })
  qrToken: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}

/** One item in a shipment, with what was received and the incoming QC. */
@Entity({ name: 'shipment_items' })
@Unique('uq_shipment_items_item', ['shipmentId', 'orderItemId'])
@Index('idx_shipment_items_item', ['orderItemId'])
@Check('chk_shipment_items_qty', `"quantity" > 0`)
@Check(
  'chk_shipment_items_received',
  `"received_qty" IS NULL OR ("received_qty" >= 0 AND "received_qty" <= "quantity")`,
)
export class ShipmentItem {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Shipment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shipment_id' })
  shipment: Shipment;

  @Column({ name: 'shipment_id', type: 'uuid' })
  shipmentId: string;

  @ManyToOne(() => LabOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: LabOrder;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => LabOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: LabOrderItem;

  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId: string;

  /** The try-in round this line delivers (lab → clinic), if any. */
  @ManyToOne(() => OrderItemStage, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_stage_id' })
  itemStage: OrderItemStage | null;

  @Column({ name: 'item_stage_id', type: 'uuid', nullable: true })
  itemStageId: string | null;

  @Column({ name: 'contents', type: 'enum', enum: ShipmentContents })
  contents: ShipmentContents;

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'received_qty', type: 'int', nullable: true })
  receivedQty: number | null;

  @Column({
    name: 'condition',
    type: 'enum',
    enum: ShipmentCondition,
    nullable: true,
  })
  condition: ShipmentCondition | null;

  @Column({ name: 'qc_result', type: 'enum', enum: QcResult, nullable: true })
  qcResult: QcResult | null;

  @Column({ name: 'qc_notes', type: 'text', nullable: true })
  qcNotes: string | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @Column({ name: 'received_by', type: 'uuid', nullable: true })
  receivedBy: string | null;
}

/**
 * A request to remake an item (lab ERD §5b, §10 "Remake decision"). Agreed
 * → a new item in the same order (`remake_of_item_id`), priced by who is
 * responsible (lab fault → lab cost and patient price both 0). An active
 * warranty marks it a warranty claim automatically.
 */
@Entity({ name: 'remake_requests' })
@Index('uq_remake_requests_open', ['originalItemId'], {
  unique: true,
  where: `"status" IN ('requested','disputed')`,
})
@Unique('uq_remake_requests_new_item', ['newItemId'])
@Index('idx_remake_requests_lab_status', ['labId', 'status'])
@Index('idx_remake_requests_order', ['orderId'])
@Check(
  'chk_remake_requests_minor',
  `("lab_charge_minor" IS NULL OR "lab_charge_minor" >= 0) AND ("patient_charge_minor" IS NULL OR "patient_charge_minor" >= 0)`,
)
export class RemakeRequest {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId: string;

  @ManyToOne(() => LabOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: LabOrder;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => LabOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'original_item_id' })
  originalItem: LabOrderItem;

  @Column({ name: 'original_item_id', type: 'uuid' })
  originalItemId: string;

  @ManyToOne(() => LabOrderItem, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'new_item_id' })
  newItem: LabOrderItem | null;

  @Column({ name: 'new_item_id', type: 'uuid', nullable: true })
  newItemId: string | null;

  @Column({ name: 'reason_code', type: 'enum', enum: RemakeReason })
  reasonCode: RemakeReason;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({
    name: 'responsible_party',
    type: 'enum',
    enum: ResponsibleParty,
    default: ResponsibleParty.UNDETERMINED,
  })
  responsibleParty: ResponsibleParty;

  @Column({ name: 'is_warranty_claim', type: 'boolean', default: false })
  isWarrantyClaim: boolean;

  @Column({ name: 'warranty_id', type: 'uuid', nullable: true })
  warrantyId: string | null;

  @MinorColumn('lab_charge_minor', { nullable: true })
  labChargeMinor: number | null;

  @MinorColumn('patient_charge_minor', { nullable: true })
  patientChargeMinor: number | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RemakeStatus,
    default: RemakeStatus.REQUESTED,
  })
  status: RemakeStatus;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  @Column({ name: 'dispute_note', type: 'text', nullable: true })
  disputeNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}

/** The warranty that starts when an item is delivered (lab ERD §14 step 8). */
@Entity({ name: 'item_warranties' })
@Unique('uq_item_warranties_item', ['itemId'])
@Check('chk_item_warranties_dates', `"ends_on" >= "starts_on"`)
export class ItemWarranty {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => LabOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: LabOrderItem;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'starts_on', type: 'date' })
  startsOn: string;

  @Column({ name: 'ends_on', type: 'date' })
  endsOn: string;

  @Column({ name: 'terms', type: 'text', nullable: true })
  terms: string | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
