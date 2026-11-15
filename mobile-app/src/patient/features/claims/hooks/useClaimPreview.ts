import { useQuery } from '@tanstack/react-query';

import { fetchClaimPreview } from '../api/claims.api';

/**
 * Read-only look at a claim token. Never retried automatically: a wrong code
 * stays wrong and counts against the rate limit. Nothing is kept after the page
 * closes — the key holds the token and the result holds a (masked) name.
 */
export function useClaimPreview(token: string | null) {
  return useQuery({
    queryKey: ['claims', 'preview', token],
    queryFn: () => fetchClaimPreview(token ?? ''),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
}
