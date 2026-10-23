import { writeFileSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcrypt';
import { bootApp, Env, seedWorld } from '../harness';

/**
 * Seeds the world the browser regression run (REG-*) logs into, in the
 * `acceptit` schema, and writes the localhost-only test credentials to
 * `browser-fixture.json` next to this file. Run it with
 *   ACCEPT_IT_REUSE_SCHEMA=1 npx jest --config ./test/jest-int-acceptance.json \
 *     --runInBand --forceExit --testRegex 'browser/browser-seed\.ts$'
 * (not part of the normal acceptance run: it matches no `*.int-spec.ts`).
 */
const PASSWORD = 'Acceptance#Test12345';
const KEYS = ['OwnerA', 'AdminU', 'Doc1', 'RecU', 'AcctU', 'SA'] as const;

describe('browser fixture', () => {
  let env: Env;
  beforeAll(async () => {
    env = await bootApp();
  }, 900_000);
  afterAll(async () => env?.close());

  it('seeds users, an org with two locations, and writes browser-fixture.json', async () => {
    const w = await seedWorld(env, 'brw');
    const hash = await bcrypt.hash(PASSWORD, 12);
    const users: Record<string, { email: string; userId: string }> = {};
    for (const k of KEYS) {
      const email = `${k.toLowerCase()}@browser.acceptance-it.test`;
      await env.ds.query(
        `UPDATE users SET email = $1, password = $2, status = 'active' WHERE uuid = $3`,
        [email, hash, w.people[k].userId],
      );
      users[k] = { email, userId: w.people[k].userId };
    }
    writeFileSync(
      join(__dirname, 'browser-fixture.json'),
      JSON.stringify(
        {
          note: 'Localhost-only test credentials for the acceptance browser run (schema acceptit).',
          password: PASSWORD,
          organizationId: w.orgA,
          locations: { L1: w.L1, L2: w.L2 },
          users,
        },
        null,
        2,
      ),
    );
    expect(Object.keys(users)).toHaveLength(KEYS.length);
  }, 900_000);
});
