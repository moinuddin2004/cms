/**
 * Run the whole process in UTC. Import this FIRST in every entry point.
 *
 * Clinic days and times come from the location's timezone (`ClockService`),
 * never from the server's — pinning the process to UTC makes any stray
 * `new Date()` / `getHours()` behave the same on a dev laptop and in prod.
 */
process.env.TZ = 'UTC';
