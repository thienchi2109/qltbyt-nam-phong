"use client"

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { equipmentKeys } from '@/hooks/use-cached-equipment'
import { repairKeys } from '@/hooks/use-cached-repair'
import { maintenanceKeys } from '@/hooks/use-cached-maintenance'
import { dashboardStatsKeys } from '@/hooks/use-dashboard-stats'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// Types for realtime events
type DatabaseEvent = 'INSERT' | 'UPDATE' | 'DELETE'
type TableName = 'thiet_bi' | 'yeu_cau_sua_chua' | 'ke_hoach_bao_tri' | 'nhat_ky_su_dung' | 'yeu_cau_luan_chuyen' | 'cong_viec_bao_tri'

interface RealtimeContextType {
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastUpdate: Date | null
  reconnect: () => void
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

const isRealtimeDebugEnabled = process.env.NODE_ENV !== 'production'

function realtimeLog(...args: unknown[]) {
  if (isRealtimeDebugEnabled) {
    console.log(...args)
  }
}

function realtimeWarn(...args: unknown[]) {
  if (isRealtimeDebugEnabled) {
    console.warn(...args)
  }
}

function clearReconnectTimeout(reconnectTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>) {
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current)
    reconnectTimeoutRef.current = null
  }
}

/** Returns the realtime connection state from the realtime provider. */
export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context
}

interface RealtimeProviderProps {
  children: React.ReactNode
}

/** Provides realtime cache invalidation and reconnect state to the app tree. */
export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  // Debounce cache invalidation to prevent excessive re-renders
  const invalidationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const scheduleReconnectRef = useRef<() => void>(() => {})

  const debouncedInvalidate = React.useCallback((queryKey: readonly string[], delay = 100) => {
    const key = queryKey.join('-')
    
    // Clear existing timeout for this query key
    const existingTimeout = invalidationTimeouts.current.get(key)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      realtimeLog(`[Realtime] Invalidating and refetching queries for:`, queryKey)

      // Invalidate and force refetch
      await queryClient.invalidateQueries({
        queryKey,
        refetchType: 'active' // Only refetch active queries
      })

      // Also trigger refetch for good measure
      queryClient.refetchQueries({
        queryKey,
        type: 'active'
      })

      invalidationTimeouts.current.delete(key)
      setLastUpdate(new Date())
      realtimeLog(`[Realtime] Cache invalidated and refetched successfully for:`, queryKey)
    }, delay)

    invalidationTimeouts.current.set(key, timeout)
  }, [queryClient])

  // Handle database changes
  const handleDatabaseChange = React.useCallback((payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    const { table, eventType } = payload
    
    realtimeLog(`[Realtime] ${eventType} on ${table}`)

    // Invalidate relevant caches based on table and event type
    switch (table as TableName) {
      case 'thiet_bi':
        // Equipment changes affect multiple areas
        // Use proper query keys from hooks
        debouncedInvalidate(['equipment']) // ['equipment'] - invalidates all equipment queries
        debouncedInvalidate(dashboardStatsKeys.all) // ['dashboard-stats'] - invalidates dashboard
        debouncedInvalidate(['reports'])
        debouncedInvalidate(['equipment-distribution'])
        break

      case 'yeu_cau_sua_chua':
        // Repair request changes also affect equipment_list_enhanced.active_repair_request_id.
        debouncedInvalidate(repairKeys.all) // ['repair'] - invalidates all repair queries
        debouncedInvalidate(['equipment_list_enhanced'])
        debouncedInvalidate(['equipment'])
        debouncedInvalidate(dashboardStatsKeys.all) // ['dashboard-stats']
        debouncedInvalidate(['reports'])
        break

      case 'ke_hoach_bao_tri':
        // Maintenance plan changes
        debouncedInvalidate(maintenanceKeys.all) // ['maintenance'] - invalidates all maintenance queries
        debouncedInvalidate(dashboardStatsKeys.all) // ['dashboard-stats']
        debouncedInvalidate(['calendar-events'])
        break

      case 'nhat_ky_su_dung':
        // Usage log changes
        debouncedInvalidate(['usage-analytics'])
        debouncedInvalidate(['equipment'])
        break

      case 'yeu_cau_luan_chuyen':
        // Transfer request changes - invalidate both Kanban and Table views
        debouncedInvalidate(['transfers-kanban'])    // Kanban board view
        debouncedInvalidate(['transfers-data-grid']) // Table/list view  
        debouncedInvalidate(['transfers'])           // Legacy (useTransferRequestsRealtime)
        debouncedInvalidate(['equipment'])
        debouncedInvalidate(['reports'])
        break

      case 'cong_viec_bao_tri':
        // Maintenance task changes
        debouncedInvalidate(['maintenance']) // maintenance queries
        debouncedInvalidate(['dashboard-stats'])
        debouncedInvalidate(['calendar-events'])
        break

      default:
        realtimeWarn(`[Realtime] Unhandled table: ${table}`)
    }

    // Show toast notification for important changes (optional)
    if (eventType === 'INSERT') {
      const messages = {
        'thiet_bi': 'Thiết bị mới đã được thêm',
        'yeu_cau_sua_chua': 'Yêu cầu sửa chữa mới',
        'ke_hoach_bao_tri': 'Kế hoạch bảo trì mới',
        'cong_viec_bao_tri': 'Công việc bảo trì mới',
        'yeu_cau_luan_chuyen': 'Yêu cầu luân chuyển mới',
        'nhat_ky_su_dung': 'Nhật ký sử dụng mới'
      }
      
      const message = messages[table as TableName]
      if (message) {
        toast({
          title: "Cập nhật dữ liệu",
          description: message,
          duration: 3000,
        })
      }
    }
  }, [debouncedInvalidate])

  // Cleanup function
  const cleanup = React.useCallback(async () => {
    if (channelRef.current) {
      const channel = channelRef.current
      channelRef.current = null
      try {
        await supabase?.removeChannel(channel)
      } catch (error) {
        console.error('[Realtime] Failed to remove channel:', error)
      }
    }

    clearReconnectTimeout(reconnectTimeoutRef)

    // Clear all pending invalidation timeouts
    invalidationTimeouts.current.forEach(timeout => clearTimeout(timeout))
    invalidationTimeouts.current.clear()

    setIsConnected(false)
    setConnectionStatus('disconnected')
  }, [])

  // Setup realtime subscription
  const setupRealtimeSubscription = React.useCallback(() => {
    if (!supabase) {
      console.error('[Realtime] Supabase client not available')
      setConnectionStatus('error')
      return
    }

    setConnectionStatus('connecting')
    
    // Create a single channel for all table subscriptions
    const channel = supabase.channel('app-realtime-sync')

    // Subscribe to tables that have Publications enabled
    const tables: TableName[] = [
      'thiet_bi',
      'yeu_cau_sua_chua',
      'ke_hoach_bao_tri',
      'nhat_ky_su_dung',
      'yeu_cau_luan_chuyen',
      'cong_viec_bao_tri'
    ]

    tables.forEach(table => {
      channel.on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: table
        },
        handleDatabaseChange
      )
    })

    // Handle connection status
    channel.on('system', {}, (payload) => {
      realtimeLog('[Realtime] System event:', payload)
      
      if (payload.extension === 'postgres_changes') {
        switch (payload.status) {
          case 'ok':
            clearReconnectTimeout(reconnectTimeoutRef)
            setIsConnected(true)
            setConnectionStatus('connected')
            reconnectAttemptsRef.current = 0
            realtimeLog('[Realtime] Connected successfully')
            break
          case 'error':
            setIsConnected(false)
            setConnectionStatus('error')
            console.error('[Realtime] Connection error:', payload)
            scheduleReconnectRef.current()
            break
        }
      }
    })

    // Subscribe to the channel
    channel.subscribe((status) => {
      realtimeLog('[Realtime] Subscription status:', status)
      
      if (status === 'SUBSCRIBED') {
        clearReconnectTimeout(reconnectTimeoutRef)
        setIsConnected(true)
        setConnectionStatus('connected')
        reconnectAttemptsRef.current = 0
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsConnected(false)
        setConnectionStatus('error')
        scheduleReconnectRef.current()
      }
    })

    channelRef.current = channel
  }, [handleDatabaseChange])

  // Schedule reconnection with exponential backoff
  const scheduleReconnect = React.useCallback(() => {
    if (reconnectTimeoutRef.current) {
      return
    }

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('[Realtime] Max reconnection attempts reached')
      setConnectionStatus('error')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000) // Max 30 seconds
    reconnectAttemptsRef.current++

    realtimeLog(`[Realtime] Scheduling reconnect attempt ${reconnectAttemptsRef.current} in ${delay}ms`)

    reconnectTimeoutRef.current = setTimeout(async () => {
      reconnectTimeoutRef.current = null
      realtimeLog('[Realtime] Attempting to reconnect...')
      await cleanup()
      setupRealtimeSubscription()
    }, delay)
  }, [cleanup, setupRealtimeSubscription])

  // Manual reconnect function
  const reconnect = React.useCallback(() => {
    realtimeLog('[Realtime] Manual reconnect triggered')
    reconnectAttemptsRef.current = 0
    void (async () => {
      await cleanup()
      setupRealtimeSubscription()
    })()
  }, [cleanup, setupRealtimeSubscription])

  useEffect(() => {
    scheduleReconnectRef.current = scheduleReconnect
  }, [scheduleReconnect])

  // Setup subscription on mount
  useEffect(() => {
    setupRealtimeSubscription()

    // Cleanup on unmount
    return () => {
      void cleanup()
    }
  }, [cleanup, setupRealtimeSubscription])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        realtimeLog('[Realtime] Page became visible, attempting to reconnect')
        reconnect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isConnected, reconnect])

  const value: RealtimeContextType = {
    isConnected,
    connectionStatus,
    lastUpdate,
    reconnect
  }

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}
