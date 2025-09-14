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

  const debouncedInvalidate = (queryKey: readonly string[], delay = 100) => {
    const key = queryKey.join('-')
    
    // Clear existing timeout for this query key
    const existingTimeout = invalidationTimeouts.current.get(key)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      console.log(`[Realtime] Invalidating and refetching queries for:`, queryKey)

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
      console.log(`[Realtime] Cache invalidated and refetched successfully for:`, queryKey)
    }, delay)

    invalidationTimeouts.current.set(key, timeout)
  }

  // Handle database changes
  const handleDatabaseChange = (payload: RealtimePostgresChangesPayload<any>) => {
    const { table, eventType, new: newRecord, old: oldRecord } = payload
    
    console.log(`[Realtime] ${eventType} on ${table}:`, { newRecord, oldRecord })

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
        // Repair request changes
        debouncedInvalidate(repairKeys.all) // ['repair'] - invalidates all repair queries
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
        // Transfer request changes
        debouncedInvalidate(['transfers'])
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
        console.warn(`[Realtime] Unhandled table: ${table}`)
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
  }

  // Setup realtime subscription
  const setupRealtimeSubscription = () => {
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
      console.log('[Realtime] System event:', payload)
      
      if (payload.extension === 'postgres_changes') {
        switch (payload.status) {
          case 'ok':
            setIsConnected(true)
            setConnectionStatus('connected')
            reconnectAttemptsRef.current = 0
            console.log('[Realtime] Connected successfully')
            break
          case 'error':
            setIsConnected(false)
            setConnectionStatus('error')
            console.error('[Realtime] Connection error:', payload)
            scheduleReconnect()
            break
        }
      }
    })

    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('[Realtime] Subscription status:', status)
      
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
        setConnectionStatus('connected')
        reconnectAttemptsRef.current = 0
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsConnected(false)
        setConnectionStatus('error')
        scheduleReconnect()
      }
    })

    channelRef.current = channel
  }

  // Schedule reconnection with exponential backoff
  const scheduleReconnect = () => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('[Realtime] Max reconnection attempts reached')
      setConnectionStatus('error')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000) // Max 30 seconds
    reconnectAttemptsRef.current++

    console.log(`[Realtime] Scheduling reconnect attempt ${reconnectAttemptsRef.current} in ${delay}ms`)

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('[Realtime] Attempting to reconnect...')
      cleanup()
      setupRealtimeSubscription()
    }, delay)
  }

  // Manual reconnect function
  const reconnect = () => {
    console.log('[Realtime] Manual reconnect triggered')
    reconnectAttemptsRef.current = 0
    cleanup()
    setupRealtimeSubscription()
  }

  // Cleanup function
  const cleanup = () => {
    if (channelRef.current) {
      supabase?.removeChannel(channelRef.current)
      channelRef.current = null
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Clear all pending invalidation timeouts
    invalidationTimeouts.current.forEach(timeout => clearTimeout(timeout))
    invalidationTimeouts.current.clear()

    setIsConnected(false)
    setConnectionStatus('disconnected')
  }

  // Setup subscription on mount
  useEffect(() => {
    setupRealtimeSubscription()

    // Cleanup on unmount
    return cleanup
  }, [])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        console.log('[Realtime] Page became visible, attempting to reconnect')
        reconnect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isConnected])

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
