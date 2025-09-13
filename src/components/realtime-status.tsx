"use client"

import React from 'react'
import { Wifi, WifiOff, RotateCcw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useRealtime } from '@/contexts/realtime-context'
import { cn } from '@/lib/utils'

interface RealtimeStatusProps {
  className?: string
  showLabel?: boolean
  variant?: 'badge' | 'button' | 'icon'
}

export function RealtimeStatus({ 
  className, 
  showLabel = false, 
  variant = 'badge' 
}: RealtimeStatusProps) {
  const { isConnected, connectionStatus, lastUpdate, reconnect } = useRealtime()

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          icon: Wifi,
          label: 'Kết nối',
          color: 'bg-green-500',
          badgeVariant: 'default' as const,
          description: 'Đang đồng bộ dữ liệu real-time'
        }
      case 'connecting':
        return {
          icon: RotateCcw,
          label: 'Đang kết nối',
          color: 'bg-yellow-500',
          badgeVariant: 'secondary' as const,
          description: 'Đang thiết lập kết nối real-time'
        }
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Lỗi kết nối',
          color: 'bg-red-500',
          badgeVariant: 'destructive' as const,
          description: 'Không thể kết nối real-time. Nhấn để thử lại.'
        }
      default:
        return {
          icon: WifiOff,
          label: 'Ngắt kết nối',
          color: 'bg-gray-500',
          badgeVariant: 'outline' as const,
          description: 'Chưa kết nối real-time'
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  const formatLastUpdate = () => {
    if (!lastUpdate) return 'Chưa có cập nhật'
    
    const now = new Date()
    const diff = now.getTime() - lastUpdate.getTime()
    
    if (diff < 60000) { // Less than 1 minute
      return 'Vừa cập nhật'
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000)
      return `${minutes} phút trước`
    } else {
      return lastUpdate.toLocaleTimeString('vi-VN')
    }
  }

  const handleClick = () => {
    if (connectionStatus === 'error' || connectionStatus === 'disconnected') {
      reconnect()
    }
  }

  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClick}
              className={cn(
                "h-8 w-8 p-0",
                connectionStatus === 'connecting' && "animate-spin",
                className
              )}
            >
              <Icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div className="font-medium">{config.description}</div>
              {lastUpdate && (
                <div className="text-xs text-muted-foreground mt-1">
                  {formatLastUpdate()}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (variant === 'button') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={connectionStatus === 'connecting'}
        className={cn(
          "gap-2",
          connectionStatus === 'connecting' && "animate-pulse",
          className
        )}
      >
        <Icon className={cn(
          "h-4 w-4",
          connectionStatus === 'connecting' && "animate-spin"
        )} />
        {showLabel && config.label}
      </Button>
    )
  }

  // Default badge variant
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={config.badgeVariant}
            className={cn(
              "gap-1 cursor-pointer",
              connectionStatus === 'connecting' && "animate-pulse",
              className
            )}
            onClick={handleClick}
          >
            <div className={cn("h-2 w-2 rounded-full", config.color)} />
            <Icon className={cn(
              "h-3 w-3",
              connectionStatus === 'connecting' && "animate-spin"
            )} />
            {showLabel && <span className="text-xs">{config.label}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <div className="font-medium">{config.description}</div>
            {lastUpdate && (
              <div className="text-xs text-muted-foreground mt-1">
                Cập nhật cuối: {formatLastUpdate()}
              </div>
            )}
            {(connectionStatus === 'error' || connectionStatus === 'disconnected') && (
              <div className="text-xs text-muted-foreground mt-1">
                Nhấn để kết nối lại
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Hook to get realtime status for use in other components
export function useRealtimeStatus() {
  const { isConnected, connectionStatus, lastUpdate } = useRealtime()
  
  return {
    isConnected,
    connectionStatus,
    lastUpdate,
    isHealthy: connectionStatus === 'connected',
    hasError: connectionStatus === 'error',
    isConnecting: connectionStatus === 'connecting'
  }
}
