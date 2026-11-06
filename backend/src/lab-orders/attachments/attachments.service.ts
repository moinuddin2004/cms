import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { orderError } from '../common/order-errors';
import { Attachment } from '../entities/attachment.entity';
import { LabOrderItem } from '../entities/lab-order-item.entity';
import type { LabOrder } from '../entities/lab-order.entity';
import {
  AttachmentEntity,
  AttachmentVisibility,
  MessageSide,
  ORDER_ENTITY,
} from '../enums/order.enums';
import {
  ATTACHMENT_STORAGE,
  AttachmentStorage,
  SIGNED_URL_TTL_SECONDS,
} from './attachment-storage';

/** Big intraoral scans (STL / PLY) included. */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export interface UploadInput {
  order: LabOrder;
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  itemId?: string | null;
  visibility: AttachmentVisibility;
  side: MessageSide;
  userId: string;
  ref: ActorRef;
}

/**
 * Order files (lab ERD §5a, §11). The server hashes what it receives
 * (sha256), stores it privately under
 * `org/{organization_id}/{entity_type}/{entity_id}/{uuid}`, and hands out
 * 10-minute signed URLs. Callers resolve the order with their own scoping
 * (clinic tenant or lab portal) first.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    @Inject(ATTACHMENT_STORAGE) private readonly storage: AttachmentStorage,
  ) {}

  async upload(input: UploadInput): Promise<Attachment> {
    const { order, file } = input;
    if (!file?.buffer?.length) {
      throw orderError('ATTACHMENT_INVALID', 'Choose a file to upload');
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw orderError('ATTACHMENT_INVALID', 'Files can be at most 50 MB');
    }
    if (input.itemId) {
      const ok = await this.dataSource
        .getRepository(LabOrderItem)
        .existsBy({ id: input.itemId, orderId: order.id });
      if (!ok) throw orderError('LAB_ORDER_ITEM_NOT_FOUND', 'Line not found');
    }
    const entityType = input.itemId
      ? AttachmentEntity.LAB_ORDER_ITEM
      : AttachmentEntity.LAB_ORDER;
    const entityId = input.itemId ?? order.id;
    const storageKey = await this.storage.put(
      `org/${order.organizationId}/${entityType}/${entityId}/${randomUUID()}`,
      { buffer: file.buffer, mimeType: file.mimetype },
    );
    return this.dataSource.transaction(async (m) => {
      const row = await m.getRepository(Attachment).save({
        organizationId: order.organizationId,
        orderId: order.id,
        entityType,
        entityId,
        storageKey,
        fileName: file.originalname.slice(0, 255),
        mimeType: (file.mimetype || 'application/octet-stream').slice(0, 100),
        sizeBytes: file.size,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        visibility: input.visibility,
        uploadedSide: input.side,
        uploadedBy: input.userId,
      });
      await this.audit.record(m, input.ref, {
        organizationId: order.organizationId,
        entityType: ORDER_ENTITY.ATTACHMENT,
        entityId: row.id,
        action: AuditAction.CREATE,
        after: {
          orderId: order.id,
          fileName: row.fileName,
          visibility: row.visibility,
        },
      });
      return row;
    });
  }

  /** A fresh short-lived download URL; `labOnly` = only lab-shared files. */
  async signedUrl(
    order: LabOrder,
    attachmentId: string,
    labOnly: boolean,
  ): Promise<{ url: string; expiresAt: string }> {
    const a = await this.dataSource
      .getRepository(Attachment)
      .findOneBy({ id: attachmentId, orderId: order.id });
    if (!a || (labOnly && a.visibility !== AttachmentVisibility.LAB_SHARED)) {
      throw orderError('ATTACHMENT_NOT_FOUND', 'File not found');
    }
    return {
      url: await this.storage.signedUrl(a.storageKey, SIGNED_URL_TTL_SECONDS),
      expiresAt: new Date(
        Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
      ).toISOString(),
    };
  }
}
