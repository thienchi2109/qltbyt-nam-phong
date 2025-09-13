import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import type { 
  RealtimeChannel, 
  RealtimePostgresInsertPayload, 
  RealtimePostgresUpdatePayload, 
  RealtimePostgresDeletePayload 
} from '@supabase/supabase-js'

interface UseRealtimeSubscriptionOptions {
  /**
   * Tên bảng trong database
   */
  table: string
  
  /**
   * Schema name (mặc định: 'public')
   */
  schema?: string
  
  /**
   * Query keys cần invalidate khi có thay đổi
   */
  queryKeys: readonly string[][]
  
  /**
   * Có hiển thị toast notification khi có thay đổi không
   */
  showNotifications?: boolean
  
  /**
   * Callback tùy chỉnh khi có INSERT
   */
  onInsert?: (payload: RealtimePostgresInsertPayload<any>) => void
  
  /**
   * Callback tùy chỉnh khi có UPDATE  
   */
  onUpdate?: (payload: RealtimePostgresUpdatePayload<any>) => void
  
  /**
   * Callback tùy chỉnh khi có DELETE
   */
  onDelete?: (payload: RealtimePostgresDeletePayload<any>) => void
  
  /**
   * Có bật subscription không (mặc định: true)
   */
  enabled?: boolean
}

/**
 * Hook để quản lý Realtime subscriptions với TanStack Query
 * Tự động invalidate cache khi có thay đổi dữ liệu
 */
export function useRealtimeSubscription({
  table,
  schema = 'public',
  queryKeys,
  showNotifications = false,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeSubscriptionOptions) {
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!supabase || !enabled) {
      return
    }

    // Cleanup existing subscription first
    if (channelRef.current) {
      console.log(`🧹 [Realtime] Cleaning up existing subscription for ${table}`)
      try {
        supabase.removeChannel(channelRef.current)
      } catch (error) {
        console.warn(`⚠️ [Realtime] Error during cleanup for ${table}:`, error)
      }
      channelRef.current = null
    }

    // Tạo unique channel name
    const channelName = `realtime_${table}_${Date.now()}`

    console.log(`🔴 [Realtime] Subscribing to ${table}`)

    try {
      // Tạo channel và subscribe
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: schema,
            table: table,
          },
          (payload) => {
            console.log(`🔄 [Realtime] Change detected in ${table}:`, payload.eventType)

            // Invalidate tất cả query keys liên quan và force refetch
            queryKeys.forEach(queryKey => {
              console.log(`🗂️ [Realtime] Invalidating query:`, queryKey)
              queryClient.invalidateQueries({
                queryKey,
                exact: false, // Cho phép partial matching
                refetchType: 'active' // Force refetch active queries
              })
            })

            // Also force refetch all active queries with the base key
            if (queryKeys.length > 0) {
              const baseKey = queryKeys[0][0]
              console.log(`🔄 [Realtime] Force refetching active queries for: ${baseKey}`)
              queryClient.refetchQueries({
                queryKey: [baseKey],
                exact: false,
                type: 'active'
              })
            }

            // Xử lý theo loại event
            switch (payload.eventType) {
              case 'INSERT':
                onInsert?.(payload as RealtimePostgresInsertPayload<any>)
                if (showNotifications) {
                  toast({
                    title: "Dữ liệu mới",
                    description: `Có bản ghi mới được thêm vào ${table}`,
                  })
                }
                break

              case 'UPDATE':
                onUpdate?.(payload as RealtimePostgresUpdatePayload<any>)
                if (showNotifications) {
                  toast({
                    title: "Dữ liệu cập nhật", 
                    description: `Bản ghi trong ${table} đã được cập nhật`,
                  })
                }
                break

              case 'DELETE':
                onDelete?.(payload as RealtimePostgresDeletePayload<any>)
                if (showNotifications) {
                  toast({
                    title: "Dữ liệu xóa",
                    description: `Bản ghi trong ${table} đã được xóa`,
                    variant: "destructive",
                  })
                }
                break
            }
          }
        )
        .subscribe((status) => {
          console.log(`📡 [Realtime] Subscription status for ${table}:`, status)
          
          if (status === 'SUBSCRIBED') {
            console.log(`✅ [Realtime] Successfully subscribed to ${table}`)
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`❌ [Realtime] Error subscribing to ${table}`)
          } else if (status === 'TIMED_OUT') {
            console.warn(`⏰ [Realtime] Subscription timeout for ${table}`)
          } else if (status === 'CLOSED') {
            console.log(`🔒 [Realtime] Subscription closed for ${table}`)
          }
        })

      channelRef.current = channel

    } catch (error) {
      console.error(`❌ [Realtime] Failed to subscribe to ${table}:`, error)
    }

    // Cleanup function
    return () => {
      if (channelRef.current && supabase) {
        console.log(`🧹 [Realtime] Cleaning up subscription for ${table}`)
        try {
          supabase.removeChannel(channelRef.current)
        } catch (error) {
          console.warn(`⚠️ [Realtime] Error during cleanup for ${table}:`, error)
        }
        channelRef.current = null
      }
    }
  }, [table, schema, enabled, JSON.stringify(queryKeys)])

  return {
    isSubscribed: !!channelRef.current,
    channel: channelRef.current
  }
}
