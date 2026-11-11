import type { QueryClient } from '@tanstack/react-query';

import { accessKeys } from '@/staff/features/access';

/**
 * After a location switch every cached answer belongs to the old place, so all
 * of it goes — except `access`. Its key carries org + location (docs/02 §6), so once
 * the store moves the new key fetches by itself and the old entry is simply
 * unused — nothing is invalidated or awaited here. Theme data is dropped too; the brand re-applies when the new location's theme arrives.
 */
export async function clearStaffCacheExceptAccess(client: QueryClient): Promise<void> {
  const notAccess = (q: { queryKey: readonly unknown[] }) => q.queryKey[0] !== accessKeys.all[0];
  await client.cancelQueries({ predicate: notAccess });
  client.removeQueries({ predicate: notAccess });
}
