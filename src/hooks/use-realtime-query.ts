"use client"

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// Types for realtime query configuration
interface RealtimeQueryConfig {
  table: string
  queryKey: string[]
  events?: ('INSERT' | 'UPDATE' | 'DELETE')[]
  filter?: string
  debounceMs?: number
}

/**
 * Hook to add realtime capabilities to React Query
 * This automatically invalidates queries when database changes occur
 */
export function useRealtimeQuery(config: RealtimeQueryConfig) {
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const {
    table,
    queryKey,
    events = ['INSERT', 'UPDATE', 'DELETE'],
    filter,
    debounceMs = 500
  } = config

  useEffect(() => {
    if (!supabase) {
      console.warn('[useRealtimeQuery] Supabase client not available')
      return
    }

    // Create unique channel name for this query
    const channelName = `realtime-query-${table}-${queryKey.join('-')}`
    const channel = supabase.channel(channelName)

    // Handle database changes with debouncing
    const handleChange = (payload: RealtimePostgresChangesPayload<any>) => {
      console.log(`[useRealtimeQuery] ${payload.eventType} on ${table}:`, payload)

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Debounce the invalidation
      timeoutRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey })
        console.log(`[useRealtimeQuery] Invalidated queries for:`, queryKey)
      }, debounceMs)
    }

    // Subscribe to postgres changes
    const subscription = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
        ...(filter && { filter })
      },
      handleChange
    )

    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log(`[useRealtimeQuery] Channel ${channelName} status:`, status)
    })

    channelRef.current = channel

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [table, queryKey.join('-'), events.join('-'), filter, debounceMs])

  return {
    isSubscribed: !!channelRef.current
  }
}

/**
 * Hook for equipment realtime updates
 */
export function useEquipmentRealtime() {
  return useRealtimeQuery({
    table: 'thiet_bi',
    queryKey: ['equipment'],
    debounceMs: 300 // Faster updates for equipment
  })
}

/**
 * Hook for repair requests realtime updates
 */
export function useRepairRequestsRealtime() {
  return useRealtimeQuery({
    table: 'yeu_cau_sua_chua',
    queryKey: ['repair'],
    debounceMs: 300
  })
}

/**
 * Hook for maintenance plans realtime updates
 */
export function useMaintenancePlansRealtime() {
  return useRealtimeQuery({
    table: 'ke_hoach_bao_tri',
    queryKey: ['maintenance'],
    debounceMs: 500
  })
}

/**
 * Hook for maintenance schedules realtime updates
 */
export function useMaintenanceSchedulesRealtime() {
  return useRealtimeQuery({
    table: 'cong_viec_bao_tri',
    queryKey: ['maintenance'],
    debounceMs: 500
  })
}

/**
 * Hook for dashboard statistics realtime updates
 */
export function useDashboardStatsRealtime() {
  const equipmentRealtime = useRealtimeQuery({
    table: 'thiet_bi',
    queryKey: ['dashboard-stats'],
    debounceMs: 1000 // Slower updates for dashboard to prevent excessive re-renders
  })

  const repairRealtime = useRealtimeQuery({
    table: 'yeu_cau_sua_chua',
    queryKey: ['dashboard-stats'],
    debounceMs: 1000
  })

  const maintenanceRealtime = useRealtimeQuery({
    table: 'ke_hoach_bao_tri',
    queryKey: ['dashboard-stats'],
    debounceMs: 1000
  })

  return {
    isSubscribed: equipmentRealtime.isSubscribed && repairRealtime.isSubscribed && maintenanceRealtime.isSubscribed
  }
}

/**
 * Hook for transfer requests realtime updates
 */
export function useTransferRequestsRealtime() {
  return useRealtimeQuery({
    table: 'yeu_cau_luan_chuyen',
    queryKey: ['transfers'],
    debounceMs: 300
  })
}

/**
 * Hook for usage analytics realtime updates
 */
export function useUsageAnalyticsRealtime() {
  return useRealtimeQuery({
    table: 'nhat_ky_su_dung',
    queryKey: ['usage-analytics'],
    debounceMs: 1000
  })
}

/**
 * Generic hook for any table realtime updates
 */
export function useTableRealtime(table: string, queryKey: string[], options?: {
  events?: ('INSERT' | 'UPDATE' | 'DELETE')[]
  filter?: string
  debounceMs?: number
}) {
  return useRealtimeQuery({
    table,
    queryKey,
    ...options
  })
}
