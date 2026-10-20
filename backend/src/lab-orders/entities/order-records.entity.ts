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
import { PaisaColumn } from 'src/billing/common/paisa-column';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import {
  ChargeKind,
  ChargeStatus,
  MessageKind,
  MessageSide,
} from '../enums/order.enums';
import { LabOrderItem } from './lab-order-item.entity';
import { LabOrder } from './lab-order.entity';

/**
 * What the lab was asked to make, as of one revision (lab ERD §13
 * "Revisions": a change after submit is a new version, never an
 * overwrite). Rev 1 is written at submit. The lab acknowledges each.
 */
@Entity({ name: 'order_revisions' })
@Unique('uq_order_revisions_no', ['orderId', 'revisionNo'])
export class OrderRevision {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => LabOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: LabOrder;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'revision_no', type: 'int' })
  revisionNo: number;

  @Column({ name: 'snapshot', type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'lab_acknowledged_at', type: 'timestamptz', nullable: true })
  labAcknowledgedAt: Date | null;

  @Column({ name: 'lab_acknowledged_by', type: 'uuid', nullable: true })
  labAcknowledgedBy: string | null;
}

/** Clinic ↔ lab conversation on an order (or one of its items). */
@Entity({ name: 'order_messages' })
@Index('idx_order_messages_order', ['orderId', 'createdAt'])
export class OrderMessage {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => LabOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: LabOrder;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => LabOrderItem, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: LabOrderItem | null;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @Column({ name: 'author_user_id', type: 'uuid', nullable: true })
  authorUserId: string | null;

  @Column({ name: 'author_side', type: 'enum', enum: MessageSide })
  authorSide: MessageSide;

  @Column({ name: 'kind', type: 'enum', enum: MessageKind })
  kind: MessageKind;

  @Column({ name: 'body', type: 'text' })
  body: string;

  /** A clarification request is resolved by the clinic's reply. */
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/**
 * An extra charge the lab asks for after submit (rush, material,
 * shipping). Approved item-level charges are added to the item's lab line
 * cost — the one way besides a revision that a frozen price changes.
 */
@Entity({ name: 'order_charge_requests' })
@Check('chk_order_charge_requests_amount', `"amount_paisa" > 0`)
@Index('idx_order_charge_requests_order', ['orderId', 'status'])
export class OrderChargeRequest {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => LabOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: LabOrder;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => LabOrderItem, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: LabOrderItem | null;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @Column({ name: 'kind', type: 'enum', enum: ChargeKind })
  kind: ChargeKind;

  @PaisaColumn('amount_paisa')
  amountPaisa: number;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'PKR' })
  currency: string;

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ChargeStatus,
    default: ChargeStatus.PENDING,
  })
  status: ChargeStatus;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}
