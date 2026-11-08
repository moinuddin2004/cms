import { Client, ClientConfig } from 'pg';
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner';
import { clockOffsetMs } from './time-travel';

/**
 * The SQL half of time travel (see time-travel.ts).
 *
 * Creates a throw-away schema `seed_clock_<pid>` holding the current offset:
 *
 * 1. `now()` returning `pg_catalog.now() + offset`. The seed's connections
 *    put this schema FIRST on their search_path, ahead of `pg_catalog`, so
 *    every unqualified `now()` in the app's SQL (queue day, lab workflow
 *    times, …) sees the simulated time.
 * 2. A BEFORE INSERT OR UPDATE trigger on every table of the data schema:
 *    timestamp columns that got the real transaction time from a column
 *    DEFAULT (`created_at DEFAULT now()`, `CURRENT_TIMESTAMP` on update)
 *    are moved by the same offset. It only acts for this process's own
 *    sessions (`current_schema()` is this clock schema), so parallel seed
 *    processes and the real app are never affected.
 *
 * Before each query the offset is synced if the JS clock moved. `drop()`
 * removes the schema — CASCADE also removes the triggers. If a run crashes,
 * drop any leftover `seed_clock_*` schema by hand (CASCADE); it holds no data.
 */
export class DbClock {
  readonly schema = `seed_clock_${process.pid}`;
  private client: Client;
  private synced = 0;
  private pending: Promise<void> | null = null;

  constructor(private readonly config: ClientConfig) {}

  private async connect(): Promise<void> {
    this.client = new Client({ ...this.config, keepAlive: true });
    // A dropped idle connection must not crash the process; the next sync reconnects.
    this.client.on('error', () => undefined);
    await this.client.connect();
  }

  /** Runs on the clock's own connection, reconnecting once if it was dropped. */
  private async exec(sql: string, params?: unknown[]) {
    try {
      return await this.client.query(sql, params as any[]);
    } catch (err) {
      if (!/terminat|ECONNRESET|not queryable|closed/i.test(String((err as Error).message))) throw err;
      await this.client.end().catch(() => undefined);
      await this.connect();
      return this.client.query(sql, params as any[]);
    }
  }

  async create(dataSchema: string): Promise<void> {
    await this.connect();
    const s = this.schema;
    await this.client.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);
    await this.client.query(`
      CREATE SCHEMA ${s};
      CREATE TABLE ${s}.state (offset_ms bigint NOT NULL);
      INSERT INTO ${s}.state VALUES (0);

      CREATE FUNCTION ${s}.now() RETURNS timestamptz LANGUAGE sql STABLE AS
      $$ SELECT pg_catalog.now() + (SELECT offset_ms FROM ${s}.state) * interval '1 millisecond' $$;

      -- TG_ARGV: the table's timestamptz / timestamp / date columns.
      CREATE FUNCTION ${s}.shift() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        off interval;
        j jsonb;
        k text;
        v text;
        changed boolean := false;
      BEGIN
        IF pg_catalog.current_schema() IS DISTINCT FROM '${s}' THEN RETURN NEW; END IF;
        SELECT offset_ms * interval '1 millisecond' INTO off FROM ${s}.state;
        IF off = interval '0' THEN RETURN NEW; END IF;
        j := to_jsonb(NEW);
        FOREACH k IN ARRAY TG_ARGV LOOP
          v := j ->> k;
          CONTINUE WHEN v IS NULL;
          IF length(v) = 10 THEN
            IF v::date = (pg_catalog.now())::date THEN
              j := jsonb_set(j, ARRAY[k], to_jsonb((pg_catalog.now() + off)::date));
              changed := true;
            END IF;
          ELSIF v::timestamptz = pg_catalog.now() THEN
            j := jsonb_set(j, ARRAY[k], to_jsonb(pg_catalog.now() + off));
            changed := true;
          END IF;
        END LOOP;
        IF changed THEN NEW := jsonb_populate_record(NEW, j); END IF;
        RETURN NEW;
      END $$;

      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT c.table_name, array_agg(quote_literal(c.column_name)) AS cols
            FROM information_schema.columns c
            JOIN information_schema.tables t
              ON t.table_schema = c.table_schema AND t.table_name = c.table_name
           WHERE c.table_schema = '${dataSchema}'
             AND t.table_type = 'BASE TABLE'
             AND c.data_type IN ('timestamp with time zone', 'timestamp without time zone', 'date')
           GROUP BY c.table_name
        LOOP
          EXECUTE format(
            'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION ${s}.shift(%s)',
            'zz_${s}', '${dataSchema}', r.table_name, array_to_string(r.cols, ',')
          );
        END LOOP;
      END $$;
    `);
    this.patchTypeorm();
  }

  /** search_path for the seed's connections. */
  searchPath(dataSchema?: string): string {
    return [this.schema, 'pg_catalog', ...(dataSchema ? [dataSchema] : []), 'public'].join(',');
  }

  private async sync(): Promise<void> {
    const want = clockOffsetMs();
    if (want === this.synced) return;
    if (!this.pending) {
      this.pending = this.exec(`UPDATE ${this.schema}.state SET offset_ms = $1`, [want])
        .then(() => {
          this.synced = want;
        })
        .finally(() => {
          this.pending = null;
        });
    }
    await this.pending;
    if (clockOffsetMs() !== this.synced) await this.sync();
  }

  private patchTypeorm(): void {
    const clock = this;
    const proto = PostgresQueryRunner.prototype as any;
    if (proto.__seedClockPatched) return;
    const original = proto.query;
    proto.query = async function (...args: any[]) {
      await clock.sync();
      return original.apply(this, args);
    };
    proto.__seedClockPatched = true;
  }

  async drop(): Promise<void> {
    if (!this.client) return;
    try {
      await this.exec(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`);
    } finally {
      await this.client.end();
    }
  }
}
