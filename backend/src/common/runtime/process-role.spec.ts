import { assertRedisForRole } from './process-role';

describe('assertRedisForRole', () => {
  const saved = process.env.REDIS_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = saved;
  });

  it('lets a single all process start without Redis', () => {
    delete process.env.REDIS_URL;
    expect(() => assertRedisForRole('all')).not.toThrow();
  });

  it.each(['api', 'worker'] as const)('requires REDIS_URL for %s', (role) => {
    delete process.env.REDIS_URL;
    expect(() => assertRedisForRole(role)).toThrow(/REDIS_URL is required/);
    process.env.REDIS_URL = 'redis://localhost:6379';
    expect(() => assertRedisForRole(role)).not.toThrow();
  });
});
