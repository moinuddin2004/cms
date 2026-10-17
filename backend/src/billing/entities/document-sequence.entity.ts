import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DocumentType } from '../enums/billing.enums';

/**
 * Atomic per-location, per-type, per-year counter (D15, 6.11). Only
 * touched through DocumentSequenceService.next() inside a transaction.
 */
@Entity({ name: 'document_sequences' })
export class DocumentSequence {
  @PrimaryColumn({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @PrimaryColumn({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @PrimaryColumn({ name: 'doc_type', type: 'enum', enum: DocumentType })
  docType: DocumentType;

  @PrimaryColumn({ name: 'year', type: 'int' })
  year: number;

  @Column({ name: 'last_value', type: 'int', default: 0 })
  lastValue: number;
}
