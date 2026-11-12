import { createQueryClient } from './create-query-client';

describe('createQueryClient', () => {
  it('defaults gcTime to 10 minutes', () => {
    expect(createQueryClient().getDefaultOptions().queries?.gcTime).toBe(10 * 60 * 1000);
  });

  it('accepts a longer gcTime and leaves the other defaults alone', () => {
    const q = createQueryClient({ gcTime: 24 * 60 * 60 * 1000 }).getDefaultOptions().queries;
    expect(q?.gcTime).toBe(24 * 60 * 60 * 1000);
    expect(q?.staleTime).toBe(5 * 60 * 1000);
    expect(q?.retry).toBe(2);
  });
});
