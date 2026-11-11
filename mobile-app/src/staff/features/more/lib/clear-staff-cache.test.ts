import { QueryClient } from '@tanstack/react-query';

import { clearStaffCacheExceptAccess } from './clear-staff-cache';

describe('clearStaffCacheExceptAccess', () => {
  it('drops every query except access, and marks access stale', async () => {
    const client = new QueryClient();
    client.setQueryData(['access', 'me', 'o1', 'l1'], { permissions: {} });
    client.setQueryData(['queue', 'board', 'l1', '2026-11-11'], { rows: [] });
    client.setQueryData(['theme', 'clinic', 'o1', 'l1'], { brand_color: '#0e7490' });

    await clearStaffCacheExceptAccess(client);

    expect(client.getQueryData(['queue', 'board', 'l1', '2026-11-11'])).toBeUndefined();
    expect(client.getQueryData(['theme', 'clinic', 'o1', 'l1'])).toBeUndefined();
    expect(client.getQueryData(['access', 'me', 'o1', 'l1'])).toEqual({ permissions: {} });
    expect(client.getQueryState(['access', 'me', 'o1', 'l1'])?.isInvalidated).toBe(true);
  });
});
