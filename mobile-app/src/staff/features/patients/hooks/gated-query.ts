import type { UseQueryResult } from '@tanstack/react-query';

import type { AccessStatus } from '@/staff/features/access';

/**
 * Result of a permission/feature-gated patient query. `loading`: `/me/access`
 * is not known yet. `denied`: the user may not read it — the query never ran,
 * so there is no error and no skeleton to show. `allowed`: use `query`.
 */
export type GatedQuery<T> =
  | { access: 'loading' }
  | { access: 'denied' }
  | { access: 'allowed'; query: UseQueryResult<T> };

/** Whether the gated query may run: access must be loaded and the check must pass. */
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
