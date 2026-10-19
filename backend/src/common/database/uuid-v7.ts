import { PrimaryColumn } from 'typeorm';

/**
 * `uuid_generate_v7()` — time-ordered UUIDs (RFC 9562) for new tables, so
 * ids sort by creation time and append-heavy indexes stay compact. Built
 * from core `gen_random_uuid()` (PG 13+): the first 48 bits become the
 * unix-ms timestamp and the version nibble flips from 4 (0100) to 7 (0111)
 * by setting bits 52 and 53; the RFC variant bits of the v4 are kept.
 *
 * Created by `ensurePostgresExtensions` before `synchronize` (dev) and by
 * the lab-management migration (prod), so column defaults can rely on it.
 */
export const UUID_V7_FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid
LANGUAGE sql VOLATILE PARALLEL SAFE AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
                placing substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                FROM 1 FOR 6),
        52, 1),
      53, 1),
    'hex')::uuid
$$`;

/** `id uuid PRIMARY KEY DEFAULT uuid_generate_v7()`. */
export function UuidV7PrimaryColumn(): PropertyDecorator {
  return PrimaryColumn({
    name: 'id',
    type: 'uuid',
    default: () => 'uuid_generate_v7()',
  });
}
