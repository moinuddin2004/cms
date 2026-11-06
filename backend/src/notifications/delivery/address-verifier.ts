import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { RecipientType } from '../notifications.enums';

/**
 * "No system email ever goes to an unverified address" (notifications +
 * email plan, Phase 2/3). Asked by the email provider right before sending,
 * so a message queued before an address changed can't slip out:
 * - user  → `users.email_verified_at` set and still this address
 * - lab   → `labs.email_verified_at` set and still this address
 * - patient → never yet: there is no patient email confirmation (the patient
 *   follow-up project adds one; until then patients get no email at all).
 */
@Injectable()
export class AddressVerifier {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async isVerified(
    type: RecipientType,
    id: string,
    address: string,
  ): Promise<boolean> {
    const table =
      type === RecipientType.USER
        ? { sql: 'users', key: 'uuid' }
        : type === RecipientType.LAB
          ? { sql: 'labs', key: 'id' }
          : null;
    if (!table) return false;
    const [row] = await sqlRows<{ ok: boolean }>(
      this.dataSource,
      `SELECT (email_verified_at IS NOT NULL
               AND lower(email) = lower($2)) AS ok
         FROM ${table.sql} WHERE ${table.key} = $1`,
      [id, address],
    );
    return row?.ok === true;
  }
}
