import type { UseQueryResult } from '@tanstack/react-query';

import type { AccessStatus } from '@/staff/features/access';

/**
 * Permission-gated query result (DECISIONS A-18). `loading`: `/me/access` not
 * known yet. `denied`: the query never ran. `allowed`: use `query`.
 */
export type GatedQuery<T> =
  | { access: 'loading' }
  | { access: 'denied' }
  | { access: 'allowed'; query: UseQueryResult<T> };

export const isGateOpen = (status: AccessStatus, check: boolean): boolean =>
  status === 'ready' && check;

export function toGated<T>(
  status: AccessStatus,
  open: boolean,
  query: UseQueryResult<T>,
): GatedQuery<T> {
  if (open) return { access: 'allowed', query };
  return { access: status === 'loading' ? 'loading' : 'denied' };
}
