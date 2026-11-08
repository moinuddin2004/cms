/**
 * `npm run seed:check` — proves the seed works WITHOUT touching your data.
 *
 * Builds the full schema inside a throw-away Postgres schema (`seedcheck`)
 * of the DATABASE_URL database, runs the seed into it, prints row counts,
 * then drops it. `public` is never read or written. `--keep` leaves the
 * schema for inspection (drop it yourself: DROP SCHEMA seedcheck CASCADE).
 */
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { Client } from 'pg';
import { pgSsl } from 'src/common/database/pg-ssl';

// Only these names, on purpose: `DROP SCHEMA … CASCADE` runs against it.
// SEED_CHECK_SCHEMA picks one (lets two checks run side by side).
const ALLOWED = ['seedcheck', 'seedcheck_a', 'seedcheck_b', 'seedcheck_c'];
const SCHEMA = process.env.SEED_CHECK_SCHEMA || 'seedcheck';
if (!ALLOWED.includes(SCHEMA)) {
  throw new Error(`SEED_CHECK_SCHEMA must be one of ${ALLOWED.join(', ')}`);
}

config({ path: join(__dirname, '../../.env') });

function directUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('Set DATABASE_URL in backend/.env');
  const url = new URL(raw);
  // Neon's pooler (pgbouncer) rejects the search_path startup option.
  url.hostname = url.hostname.replace('-pooler', '');
  url.searchParams.delete('channel_binding');
  return url.toString();
}

async function main() {
  const url = directUrl();
  const keep = process.argv.includes('--keep');
  const client = new Client({ connectionString: url, ssl: pgSsl() || undefined });
  await client.connect();
  try {
    console.log(`[check] building schema "${SCHEMA}"…`);
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${SCHEMA}`);
    await client.query(`SET search_path TO ${SCHEMA}, public`);
    const dir = join(__dirname, '../schema');
    for (const f of [
      '01_extensions_functions.sql',
      '02_tables.sql',
      '03_foreign_keys_circular.sql',
      '04_search_indexes.sql',
      '05_triggers.sql',
    ]) {
      await client.query(readFileSync(join(dir, f), 'utf8'));
    }

    console.log('[check] running the seed…');
    const res = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register/transpile-only', '-r', 'tsconfig-paths/register', join(__dirname, 'run.ts')],
      {
        stdio: 'inherit',
        env: { ...process.env, SEED_DATABASE_URL: url, SEED_SCHEMA: SCHEMA },
        cwd: join(__dirname, '../..'),
      },
    );
    if (res.status !== 0) throw new Error(`seed exited with ${res.status}`);

    const { rows: tables } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
      [SCHEMA],
    );
    console.log('[check] rows per table (non-empty):');
    let empty = 0;
    for (const { table_name } of tables) {
      const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${SCHEMA}."${table_name}"`);
      if (rows[0].n > 0) console.log(`  ${String(table_name).padEnd(40)} ${rows[0].n}`);
      else empty++;
    }
    console.log(`  (${empty} tables empty)`);
    console.log('[check] OK');
  } finally {
    if (!keep) await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    else console.log(`[check] kept schema "${SCHEMA}"`);
    await client.end();
  }
}

main().catch((err) => {
  console.error('[check] FAILED:', err.message ?? err);
  process.exit(1);
});
