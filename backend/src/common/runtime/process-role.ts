/**
 * Which half of the modular monolith this process runs (architecture doc §2/§10):
 * - `api`    — HTTP + Socket.IO gateway. Receives realtime events from the
 *              worker over Redis; runs no background jobs. Scale to 2+.
 * - `worker` — outbox relay + scheduled jobs. No HTTP. Run exactly one.
 * - `all`    — both in one process, relay publishes in-process (no Redis
 *              needed). Default for `npm run start:dev`.
 */
export type ProcessRole = 'all' | 'api' | 'worker';

export const runsHttp = (role: ProcessRole) => role !== 'worker';
export const runsJobs = (role: ProcessRole) => role !== 'api';
