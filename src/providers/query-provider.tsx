"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import * as React from 'react'

// Create a client with optimized settings
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cache data for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Keep cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Retry failed requests
        retry: 2,
        // Refetch on window focus for important data
        refetchOnWindowFocus: true,
        // Refetch on network reconnect
        refetchOnReconnect: true,
        // Background refetch interval (10 minutes)
        refetchInterval: 10 * 60 * 1000,
      },
      mutations: {
        // Retry failed mutations
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
} 