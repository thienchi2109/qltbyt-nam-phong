import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Vitest-friendly QueryClient factory: zero retry, zero gc-time so each test
 * starts from a clean cache and async assertions don't race against background
 * retries. Use as `wrapper: createReactQueryWrapper(createTestQueryClient())`
 * inside `renderHook` / `render` calls.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

/**
 * Returns a `wrapper` component that provides the given QueryClient to the
 * tree under test. Pure helper — no JSX so the file can stay `.ts`.
 */
export function createReactQueryWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}
