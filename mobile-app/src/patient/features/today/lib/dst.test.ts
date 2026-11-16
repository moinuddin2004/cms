import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * Runs `dst.tzcase.ts` in a child Jest with `TZ=America/New_York` (the zone of a Jest process cannot
 * be changed from inside a test file, and the day-boundary maths follows the phone's own zone).
 */
describe('dose day boundaries under daylight saving', () => {
  it('spring-forward and fall-back days (child jest, TZ=America/New_York)', () => {
    const root = path.resolve(__dirname, '../../../../..');
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, 'node_modules', 'jest', 'bin', 'jest.js'),
        '--runInBand',
        '--forceExit',
        '--testTimeout=60000',
        '--testMatch',
        '**/today/lib/dst.tzcase.ts',
        '--rootDir',
        root,
      ],
      { cwd: root, env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8', timeout: 240000 },
    );
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toContain('Tests:');
    expect(output).not.toMatch(/Tests:.*failed/);
    expect(result.status).toBe(0);
  }, 260000);
});
