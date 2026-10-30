/**
 * Which half of the modular monolith this process runs (architecture doc §2/§10):
 * - `api`    — HTTP + Socket.IO gateway. Receives realtime events from the
 *              worker over Redis; runs no background jobs. Scale to 2+.
 * - `worker` — outbox relay + scheduled jobs. No HTTP. Run exactly one.
 * - `all`    — both in one process, relay publishes in-process (no Redis
 *              needed). Default for `npm run start:dev` and `start:prod`.
 */
export type ProcessRole = 'all' | 'api' | 'worker';

export const runsHttp = (role: ProcessRole) => role !== 'worker';
export const runsJobs = (role: ProcessRole) => role !== 'api';

/**
 * Split roles talk to each other only through Redis, so a missing
 * `REDIS_URL` there is a deployment error — fail at start-up instead of
 * running with screens that never get realtime events.
 */
export function assertRedisForRole(role: ProcessRole) {
  if (role !== 'all' && !process.env.REDIS_URL) {
    throw new Error(
      `REDIS_URL is required for the '${role}' process role. ` +
        `Run a single 'all' process (npm run start:prod) to go without Redis.`,
    );
  }
}
