import { Check, Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import {
  AttachmentEntity,
  AttachmentVisibility,
  MessageSide,
} from '../enums/order.enums';

/**
 * A file on an order or item (lab ERD §5a, §11): the bytes live in private
 * storage, the row keeps the key, size, mime and sha256. Polymorphic, so the
 * parent is checked in the app layer; the CHECK limits the entity types.
 * Downloads are short-lived signed URLs; the lab sees `lab_shared` only.
 * Never deleted.
 */
@Entity({ name: 'attachments' })
@Check(
  'chk_attachments_entity_type',
  `"entity_type" IN ('lab_order','lab_order_item')`,
)
@Check('chk_attachments_size', `"size_bytes" >= 0`)
@Index('idx_attachments_entity', ['entityType', 'entityId'])
export class Attachment {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 30 })
  entityType: AttachmentEntity;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  /** The order the file belongs to (also for item files) — for scoping. */
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({
    name: 'size_bytes',
    type: 'bigint',
    transformer: {
      to: (v: number) => v,
      from: (v: string | null) => (v === null ? null : Number(v)),
    },
  })
  sizeBytes: number;

  @Column({ name: 'sha256', type: 'char', length: 64 })
  sha256: string;

  @Column({ name: 'visibility', type: 'enum', enum: AttachmentVisibility })
  visibility: AttachmentVisibility;

  @Column({ name: 'uploaded_side', type: 'enum', enum: MessageSide })
  uploadedSide: MessageSide;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
