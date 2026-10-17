import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { DOC_NUMBER_PAD, DOC_PREFIX } from '../billing.constants';
import { DocumentType } from '../enums/billing.enums';
import { BillingSettingsService } from '../settings/billing-settings.service';
import { billingError } from '../common/billing-errors';

/**
 * Gapless per-location, per-type, per-year numbers (D15, 6.11). The upsert
 * row-locks the counter until the surrounding transaction ends, so
 * concurrent callers serialise; a rollback rolls the counter back too.
 * MUST be called inside a transaction.
 */
@Injectable()
export class DocumentSequenceService {
  constructor(private readonly settings: BillingSettingsService) {}

  async next(
    manager: EntityManager,
    tenant: TenantContext,
    docType: DocumentType,
    clinicDate: string,
  ): Promise<string> {
    const year = Number(clinicDate.slice(0, 4));
    const { documentCode } = await this.settings.getOrCreate(manager, tenant);
    if (!documentCode) {
      throw billingError(
        'BILLING_LOCATION_CODE_MISSING',
        'Set a document code for this location in billing settings first',
      );
    }
    const rows: Array<{ last_value: number }> = await manager.query(
      `INSERT INTO document_sequences (organization_id, location_id, doc_type, year, last_value)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (organization_id, location_id, doc_type, year)
       DO UPDATE SET last_value = document_sequences.last_value + 1
       RETURNING last_value`,
      [tenant.organizationId, tenant.locationId, docType, year],
    );
    const seq = String(rows[0].last_value).padStart(DOC_NUMBER_PAD, '0');
    return `${documentCode}-${DOC_PREFIX[docType]}-${year}-${seq}`;
  }
}
