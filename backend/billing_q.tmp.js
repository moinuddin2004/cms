// temp helper (billing agent): node billing_q.tmp.js "<sql>"  — runs in seedcheck_a only
require('dotenv').config({ path: __dirname + '/.env' });
const { Client } = require('pg');
const u = new URL(process.env.DATABASE_URL); u.hostname = u.hostname.replace('-pooler',''); u.searchParams.delete('channel_binding');
(async () => {
  const c = new Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('SET search_path TO seedcheck_a, public');
  const r = await c.query(process.argv[2]);
  console.table(r.rows);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
