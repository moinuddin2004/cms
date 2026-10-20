import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { LabOrder } from 'src/lab-orders/entities/lab-order.entity';
import { Lab } from 'src/labs/entities/lab.entity';
import { Organization } from 'src/organizations/entities/organization.entity';

export enum MagicLinkPurpose {
  LAB_VIEW_ORDER = 'lab_view_order',
  LAB_UPDATE_ORDER = 'lab_update_order',
  /** Sprint 8 (shipments). */
  RECEIVE_SHIPMENT = 'receive_shipment',
}

/** How the clinic handed the link over. */
export enum MagicLinkDelivery {
  /** Through the notification outbox (WhatsApp / email to the lab). */
  NOTIFICATION = 'notification',
  /** Shown once to clinic staff to paste wherever they like. */
  COPY = 'copy',
}

/**
 * A no-login link for one lab and one order (lab ERD §7 "Magic link
 * security"). The token is never stored: only `token_hash` (sha256). The
 * token itself is HMAC(server secret, `nonce`) — 32 random bytes of nonce,
 * 32 bytes of token — so the outbox worker can put it into the message at
 * send time without the outbox ever holding it. Revoked when the order
 * closes; every action taken through it is a `status_history` row with
 * `via = magic_link`.
 */
@Entity({ name: 'magic_links' })
@Index('idx_magic_links_order', ['orderId', 'createdAt'])
@Check(
  'chk_magic_links_uses',
  `"max_uses" IS NULL OR ("max_uses" > 0 AND "used_count" <= "max_uses")`,
)
export class MagicLink {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /** sha256 hex of the token. */
  @Index('uq_magic_links_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  /** Random input of the token derivation (not the token). */
  @Column({ name: 'nonce', type: 'char', length: 64, select: false })
  nonce: string;

  @Column({ name: 'purpose', type: 'enum', enum: MagicLinkPurpose })
  purpose: MagicLinkPurpose;

  @ManyToOne(() => Lab, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId: string;

  @ManyToOne(() => LabOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: LabOrder;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  /** Shipment links (Sprint 8); no FK until that table exists here. */
  @Column({ name: 'shipment_id', type: 'uuid', nullable: true })
  shipmentId: string | null;

  @Column({
    name: 'recipient_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  recipientPhone: string | null;

  @Column({ name: 'delivery', type: 'enum', enum: MagicLinkDelivery })
  delivery: MagicLinkDelivery;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /** Null = unlimited until expiry. */
  @Column({ name: 'max_uses', type: 'int', nullable: true })
  maxUses: number | null;

  /** Actions taken through the link (views are not counted). */
  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'last_viewed_at', type: 'timestamptz', nullable: true })
  lastViewedAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** `order_closed`, `revoked_by_clinic`, `replaced`. */
  @Column({
    name: 'revoked_reason',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  revokedReason: string | null;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
