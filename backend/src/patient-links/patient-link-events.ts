import type { EntityManager } from 'typeorm';

/** Domain events of the link lifecycle (07 §8). */
export type PatientLinkEventCode =
  | 'patient.record_linked'
  | 'patient.link_revoked';

/**
 * Publishes a link event to the patient's realtime room in the caller's
 * transaction (transactional outbox → relay → `patient:<accountId>`, 07 §7).
 * Ids only — no names, no PHI. Push/email delivery to the patient is built
 * with the patient notification channel (M3-07).
 */
export async function publishPatientLinkEvent(
  manager: EntityManager,
  event: {
    code: PatientLinkEventCode;
    organizationId: string;
    accountId: string;
    linkId: string;
  },
): Promise<void> {
  await manager.query(
    `INSERT INTO outbox (organization_id, topic, payload) VALUES ($1, $2, $3)`,
    [
      event.organizationId,
      `patient:${event.accountId}`,
      JSON.stringify({
        type: 'feed.changed',
        kinds: ['links'],
        event: event.code,
        linkId: event.linkId,
      }),
    ],
  );
  await manager.query(`SELECT pg_notify('queue_outbox', '')`);
}
