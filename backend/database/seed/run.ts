/**
 * `npm run seed` — fills an EMPTY database with demo data (see README.md).
 *
 * Order: build the schema (database/schema/run_all.sql) → `npm run seed`.
 * The app's own catalogs (feature flags, permissions, notification events,
 * forms, lab catalog) are inserted on boot, the same as when the API starts.
 *
 * Three phases:
 *  1. setup steps (clinics, staff, patients, catalogs) in this process;
 *  2. the day-by-day visits, one CHILD PROCESS PER CLINIC running in
 *     parallel (each has its own time-travel clock; a hosted DB is ~100 ms a
 *     query, so this is the slow part). `SEED_PARALLEL=0` runs them here;
 *  3. steps that use the history (lab orders, payroll, backdating).
 *
 * `SEED_ONLY=billing,labs` runs the core steps plus only those optional
 * groups (handy while working on one area; `npm run seed:check` honours it).
 */
import './lib/time-travel'; // FIRST: patches Date before any module loads
import 'src/bootstrap/utc';
import { spawn } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { travelHome } from './lib/time-travel';
import { bootSeedApp, SeedApp } from './lib/seed-app';
import { Rng, SeedContext, SeedVisit, log } from './lib/context';
import { localDate } from 'src/common/clock/tz.util';
import { AFTER_STEPS, SETUP_STEPS, SeedStep, VISITS_GROUP } from './steps';
import { seedVisits } from './steps/06-visits';
import { printLogins } from './steps/99-finish';

const only = (process.env.SEED_ONLY || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const enabled = (group?: string) => !only.length || !group || only.includes(group);
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

function newContext(app: SeedApp): SeedContext {
  return {
    app,
    rng: new Rng(20261108),
    superAdminId: '',
    clinics: [],
    logins: [],
    today: localDate('Asia/Karachi', new Date()),
    historyDays: Number(process.env.SEED_HISTORY_DAYS || 60),
    hooks: { endOfDay: [] },
    data: {},
  };
}

/** Everything in ctx that a child process needs (no app / rng / hooks). */
function serialize(ctx: SeedContext): string {
  const { app: _a, rng: _r, hooks: _h, ...plain } = ctx;
  return JSON.stringify(plain);
}

async function runStep(ctx: SeedContext, step: SeedStep): Promise<void> {
  const t0 = Date.now();
  await step.run(ctx);
  travelHome();
  step.registerHooks?.(ctx);
  log(`✓ ${step.name} (${Math.round((Date.now() - t0) / 1000)}s)`);
}

// ── Main process ──────────────────────────────────────────────────────

async function main() {
  const started = Date.now();
  const app = await bootSeedApp();
  try {
    const [{ count }] = await app.ds.query(`SELECT count(*)::int AS count FROM organizations`);
    if (count > 0 && !process.argv.includes('--force')) {
      throw new Error(
        `The database already has ${count} organization(s). The seed is for an EMPTY database ` +
          `(rebuild it with database/schema first). Pass --force to seed anyway.`,
      );
    }
    const ctx = newContext(app);

    for (const step of SETUP_STEPS) if (enabled(step.group)) await runStep(ctx, step);

    if (enabled(VISITS_GROUP)) {
      const t0 = Date.now();
      if (process.env.SEED_PARALLEL === '0') await seedVisits(ctx);
      else ctx.visits = await visitsInChildren(ctx);
      log(`✓ visits: ${ctx.visits!.length} completed (${Math.round((Date.now() - t0) / 1000)}s)`);
    }

    for (const step of AFTER_STEPS) if (enabled(step.group)) await runStep(ctx, step);

    printLogins(ctx);
    log(`done in ${Math.round((Date.now() - started) / 1000)}s`);
  } finally {
    travelHome();
    await app.close();
  }
}

/** One child per clinic; returns all their completed visits, oldest first. */
async function visitsInChildren(ctx: SeedContext): Promise<SeedVisit[]> {
  const dir = mkdtempSync(join(tmpdir(), 'cms-seed-'));
  try {
    const ctxFile = join(dir, 'ctx.json');
    writeFileSync(ctxFile, serialize(ctx));
    const results = await Promise.all(
      ctx.clinics.map((c) => runChild(c.key, ctxFile, join(dir, `visits-${c.key}.json`))),
    );
    return results.flat().sort((a, b) => a.ymd.localeCompare(b.ymd));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runChild(clinicKey: string, ctxFile: string, outFile: string): Promise<SeedVisit[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '-r', 'ts-node/register/transpile-only',
        '-r', 'tsconfig-paths/register',
        __filename,
        `--child=${clinicKey}`,
        `--ctx=${ctxFile}`,
        `--out=${outFile}`,
      ],
      { cwd: join(__dirname, '../..'), env: { ...process.env, SEED_POOL_MAX: '4' } },
    );
    const prefix = (chunk: Buffer, to: NodeJS.WriteStream) =>
      chunk
        .toString()
        .split('\n')
        .filter((l) => l.trim())
        .forEach((l) => to.write(`[${clinicKey}] ${l}\n`));
    child.stdout.on('data', (c) => prefix(c, process.stdout));
    child.stderr.on('data', (c) => prefix(c, process.stderr));
    child.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`visits for ${clinicKey} failed (exit ${code})`));
      resolve(JSON.parse(readFileSync(outFile, 'utf8')));
    });
  });
}

// ── Child process: one clinic's visits ────────────────────────────────

async function child(clinicKey: string, ctxFile: string, outFile: string) {
  const app = await bootSeedApp();
  try {
    const plain = JSON.parse(readFileSync(ctxFile, 'utf8'));
    const ctx: SeedContext = {
      ...plain,
      app,
      rng: new Rng([...clinicKey].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)),
      hooks: { endOfDay: [] },
    };
    for (const step of SETUP_STEPS) if (enabled(step.group)) step.registerHooks?.(ctx);
    await seedVisits(ctx, [clinicKey]);
    writeFileSync(outFile, JSON.stringify(ctx.visits ?? []));
  } finally {
    travelHome();
    await app.close();
  }
}

const childKey = arg('child');
(childKey ? child(childKey, arg('ctx')!, arg('out')!) : main()).catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed] FAILED:', err?.response ?? err);
  process.exit(1);
});
