import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Never re-send a write on its own: a 4xx will fail the same way again,
      // and re-sending a POST after a dropped response can create a duplicate.
      retry: false,
    },
  },
})

export default queryClient
