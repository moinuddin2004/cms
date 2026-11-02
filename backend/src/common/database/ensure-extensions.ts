import { DataSource } from 'typeorm';
import { UUID_V7_FUNCTION_SQL } from './uuid-v7';
import { upgradeNaiveTimestamps } from './timestamptz';
import { renamePaisaToMinor } from './minor-units';

/**
 * Postgres extensions (and functions) the entities rely on but TypeORM's
 * synchronize does not install itself. Must run BEFORE the main DataSource
 * initializes, because synchronize creates constraints/defaults that need them:
 * - btree_gist: `appointments.no_doctor_overlap` (uuid `=` inside a GiST
 *   exclusion constraint).
 * - uuid_generate_v7(): primary-key default of the lab-management tables.
 */
const REQUIRED_EXTENSIONS = ['btree_gist'];

export async function ensurePostgresExtensions(
  connectionString: string | undefined,
): Promise<void> {
  if (!connectionString) return;
  const ds = new DataSource({
    type: 'postgres',
    url: connectionString,
    ssl: { rejectUnauthorized: false },
    entities: [],
  });
  await ds.initialize();
  try {
    for (const ext of REQUIRED_EXTENSIONS) {
      await ds.query(`CREATE EXTENSION IF NOT EXISTS ${ext}`);
    }
    await ds.query(UUID_V7_FUNCTION_SQL);
    // Not an extension, but it too has to happen before synchronize.
    await upgradeNaiveTimestamps(ds);
    await renamePaisaToMinor(ds);
  } finally {
    await ds.destroy();
  }
}
