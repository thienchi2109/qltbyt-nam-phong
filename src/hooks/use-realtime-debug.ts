"use client"

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/contexts/realtime-context'
import { dashboardStatsKeys } from '@/hooks/use-dashboard-stats'

interface QueryState {
  queryKey: string[]
  status: string
  dataUpdatedAt: number
  isStale: boolean
  isFetching: boolean
}

export function useRealtimeDebug() {
  const queryClient = useQueryClient()
  const { isConnected, connectionStatus, lastUpdate } = useRealtime()
  const [queryStates, setQueryStates] = useState<QueryState[]>([])

  // Monitor dashboard query states
  useEffect(() => {
    const interval = setInterval(() => {
      const dashboardQueries = [
        dashboardStatsKeys.totalEquipment(),
        dashboardStatsKeys.maintenanceCount(),
        dashboardStatsKeys.repairRequests(),
        dashboardStatsKeys.maintenancePlans(),
        dashboardStatsKeys.equipmentAttention(),
      ]

      const states = dashboardQueries.map(queryKey => {
        const query = queryClient.getQueryState(queryKey)
        const queryCache = queryClient.getQueryCache().find({ queryKey })
        
        // Debug logging
        if (queryKey.join('-').includes('equipment-attention')) {
          console.log(`[RealtimeDebug] Query state for ${queryKey.join(' → ')}:`, {
            query,
            queryCache,
            queryExists: !!query,
            cacheExists: !!queryCache
          })
        }
        
        return {
          queryKey: [...queryKey],
          status: query?.status || (queryCache?.state?.status) || 'not-found',
          dataUpdatedAt: query?.dataUpdatedAt || queryCache?.state?.dataUpdatedAt || 0,
          isStale: query ? (Date.now() - query.dataUpdatedAt) > 5 * 60 * 1000 : false,
          isFetching: queryCache?.state.fetchStatus === 'fetching' || false,
        }
      })

      setQueryStates(states)
    }, 1000) // Update every second

    return () => clearInterval(interval)
  }, [queryClient])

  // Ensure all dashboard queries are triggered at least once
  useEffect(() => {
    const dashboardQueries = [
      dashboardStatsKeys.totalEquipment(),
      dashboardStatsKeys.maintenanceCount(),
      dashboardStatsKeys.repairRequests(),
      dashboardStatsKeys.maintenancePlans(),
      dashboardStatsKeys.equipmentAttention(),
    ]

    // Trigger refetch for any queries that exist but might be stale
    dashboardQueries.forEach(queryKey => {
      const query = queryClient.getQueryState(queryKey)
      if (!query || query.status === 'error') {
        console.log(`[RealtimeDebug] Query not found or has error, triggering invalidation for:`, queryKey)
        queryClient.invalidateQueries({ queryKey })
      }
    })
  }, [queryClient])

  // Log realtime events
  useEffect(() => {
    if (lastUpdate) {
      console.log(`[RealtimeDebug] Last update: ${lastUpdate.toISOString()}`)
      console.log(`[RealtimeDebug] Query states:`, queryStates)
    }
  }, [lastUpdate, queryStates])

  return {
    isConnected,
    connectionStatus,
    lastUpdate,
    queryStates,
    
    // Manual invalidation functions for testing
    invalidateDashboard: () => {
      console.log('[RealtimeDebug] Manually invalidating dashboard queries...')
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.totalEquipment() })
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.maintenanceCount() })
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.repairRequests() })
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.maintenancePlans() })
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.equipmentAttention() })
    },

    refetchDashboard: () => {
      console.log('[RealtimeDebug] Manually refetching dashboard queries...')
      queryClient.refetchQueries({ queryKey: [...dashboardStatsKeys.all] })
      queryClient.refetchQueries({ queryKey: [...dashboardStatsKeys.totalEquipment()] })
      queryClient.refetchQueries({ queryKey: [...dashboardStatsKeys.maintenanceCount()] })
      queryClient.refetchQueries({ queryKey: [...dashboardStatsKeys.repairRequests()] })
      queryClient.refetchQueries({ queryKey: [...dashboardStatsKeys.maintenancePlans()] })
      queryClient.refetchQueries({ queryKey: [...dashboardStatsKeys.equipmentAttention()] })
    }
  }
} 