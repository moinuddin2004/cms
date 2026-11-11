import { QueryClient } from '@tanstack/react-query';

/**
 * A TanStack Query client with the app defaults. Each space creates exactly one
 * (`staffQueryClient`, later `patientQueryClient`), so their caches never mix.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 2,
      },
      mutations: {
        // Never re-send a write on its own: a 4xx fails the same way again, and
        // re-sending a POST after a dropped response can create a duplicate.
        retry: false,
      },
    },
  });
}
