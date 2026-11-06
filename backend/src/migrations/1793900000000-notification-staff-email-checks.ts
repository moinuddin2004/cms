import { MigrationInterface, QueryRunner } from 'typeorm';

const AUDIENCES = `'patient', 'doctor', 'coordinator', 'lab', 'staff'`;
const STATUSES = `'queued', 'held_quiet_hours', 'sent', 'delivered', 'failed', 'skipped_disabled', 'skipped_opt_out', 'skipped_unverified'`;

/**
 * Notifications + email (docs/notifications-email-plan.md, P3/P4): the new
 * `staff` audience and the `skipped_unverified` outbox status. The entities'
 * `@Check`s list them, but synchronize keeps a same-named CHECK whose
 * expression changed — so the constraints are replaced here.
 * Idempotent: DROP IF EXISTS + ADD with the full current lists.
 */
export class NotificationStaffEmailChecks1793900000000
  implements MigrationInterface
{
  name = 'NotificationStaffEmailChecks1793900000000';

  public async up(q: QueryRunner): Promise<void> {
    await this.replace(
      q,
      'notification_outbox',
      'chk_notification_outbox_audience',
      `"audience" IN (${AUDIENCES})`,
    );
    await this.replace(
      q,
      'notification_outbox',
      'chk_notification_outbox_status',
      `"status" IN (${STATUSES})`,
    );
    await this.replace(
      q,
      'notification_rules',
      'chk_notification_rules_audience',
      `"audience" IN (${AUDIENCES})`,
    );
    await this.replace(
      q,
      'notification_audience_settings',
      'chk_notification_audience_settings_audience',
      `"audience" IN (${AUDIENCES})`,
    );
  }

  public async down(): Promise<void> {
    // Narrowing the lists again would reject existing rows; nothing to undo.
  }

  private async replace(
    q: QueryRunner,
    table: string,
    name: string,
    expression: string,
  ): Promise<void> {
    if (!(await q.hasTable(table))) return;
    await q.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}"`);
    await q.query(
      `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expression})`,
    );
  }
}
