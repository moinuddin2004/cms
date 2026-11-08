import { NotificationDispatcher } from 'src/notifications/delivery/notification-dispatcher.service';
import { travelHome } from '../lib/time-travel';
import { SeedContext, log } from '../lib/context';

/**
 * Leave the database as if the API had been running all along:
 * - deliver notifications still queued (in-app → the bell; email is only
 *   logged because the seed has no SMTP);
 * - mark realtime outbox rows as published, so the API doesn't replay
 *   three months of queue events to sockets on its first start.
 */
export async function seedTidy(ctx: SeedContext): Promise<void> {
  travelHome();
  const result = await ctx.app.get(NotificationDispatcher).drain();
  const [{ count }] = await ctx.app.ds.query(
    `WITH u AS (UPDATE outbox SET published_at = created_at WHERE published_at IS NULL RETURNING 1)
     SELECT count(*)::int AS count FROM u`,
  );
  log(`notifications delivered: ${result.sent}; realtime outbox marked published: ${count}`);
}
