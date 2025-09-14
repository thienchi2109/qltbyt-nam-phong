/**
 * Phase 3: Department Filtering Performance Monitoring Hook
 * 
 * This hook provides real-time performance monitoring for department-based filtering,
 * including query times, cache hit rates, and user experience metrics.
 */

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { DepartmentCacheUtils, CachePerformanceMonitor } from '@/lib/advanced-cache-manager'

interface PerformanceMetrics {
  // Query performance
  avgQueryTime: number
  totalQueries: number
  slowQueries: number // queries > 1000ms
  
  // Cache performance
  cacheHitRate: number
  totalCacheRequests: number
  
  // User experience
  pageLoadTime: number
  filterResponseTime: number
  
  // Department-specific metrics
  departmentItemCount: number
  lastUpdateTime: string
}

interface PerformanceAlert {
  type: 'warning' | 'error' | 'info'
  message: string
  timestamp: string
  metric?: string
  value?: number
}

export function useDepartmentPerformance() {
  const { data: session } = useSession()
  const user = session?.user
  const queryClient = useQueryClient()
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    avgQueryTime: 0,
    totalQueries: 0,
    slowQueries: 0,
    cacheHitRate: 0,
    totalCacheRequests: 0,
    pageLoadTime: 0,
    filterResponseTime: 0,
    departmentItemCount: 0,
    lastUpdateTime: new Date().toISOString(),
  })
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  
  // Performance monitoring refs
  const performanceMonitor = useRef(new CachePerformanceMonitor())
  const queryTimes = useRef<number[]>([])
  const pageLoadStart = useRef(performance.now())
  
  // Get user's cache scope (cast NextAuth user to our User type)
  const cacheScope = DepartmentCacheUtils.getUserCacheScope(user as any)
  
  // Monitor query performance
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event.query.state.status === 'success') {
        const queryKey = event.query.queryKey
        const fetchTime = event.query.state.dataUpdatedAt - (event.query.state.errorUpdatedAt || 0)
        
        // Only monitor department-related queries
        if (Array.isArray(queryKey) && (
          queryKey.includes('equipment') || 
          queryKey.includes('repair-requests') ||
          queryKey.includes('dept')
        )) {
          recordQueryPerformance(fetchTime)
          performanceMonitor.current.recordCacheHit(queryKey.join(':'), fetchTime)
        }
      }
    })
    
    return unsubscribe
  }, [queryClient])
  
  // Record query performance
  const recordQueryPerformance = (queryTime: number) => {
    queryTimes.current.push(queryTime)
    
    // Keep only last 50 queries for rolling average
    if (queryTimes.current.length > 50) {
      queryTimes.current = queryTimes.current.slice(-50)
    }
    
    const avgTime = queryTimes.current.reduce((sum, time) => sum + time, 0) / queryTimes.current.length
    const slowQueries = queryTimes.current.filter(time => time > 1000).length
    
    setMetrics(prev => ({
      ...prev,
      avgQueryTime: avgTime,
      totalQueries: prev.totalQueries + 1,
      slowQueries: prev.slowQueries + (queryTime > 1000 ? 1 : 0),
      lastUpdateTime: new Date().toISOString(),
    }))
    
    // Generate alerts for slow queries
    if (queryTime > 2000) {
      addAlert({
        type: 'warning',
        message: `Slow query detected: ${queryTime.toFixed(0)}ms`,
        timestamp: new Date().toISOString(),
        metric: 'queryTime',
        value: queryTime,
      })
    }
  }
  
  // Add performance alert
  const addAlert = (alert: PerformanceAlert) => {
    setAlerts(prev => {
      const newAlerts = [alert, ...prev].slice(0, 10) // Keep only last 10 alerts
      return newAlerts
    })
  }
  
  // Calculate cache hit rate
  useEffect(() => {
    const interval = setInterval(() => {
      const report = performanceMonitor.current.getPerformanceReport()
      
      if (report.length > 0) {
        const totalRequests = report.reduce((sum, item) => sum + item.totalRequests, 0)
        const totalHits = report.reduce((sum, item) => sum + (item.totalRequests * item.hitRate), 0)
        const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0
        
        setMetrics(prev => ({
          ...prev,
          cacheHitRate: hitRate,
          totalCacheRequests: totalRequests,
        }))
        
        // Alert for low cache hit rate
        if (hitRate < 0.7 && totalRequests > 10) {
          addAlert({
            type: 'warning',
            message: `Low cache hit rate: ${(hitRate * 100).toFixed(1)}%`,
            timestamp: new Date().toISOString(),
            metric: 'cacheHitRate',
            value: hitRate,
          })
        }
      }
    }, 30000) // Check every 30 seconds
    
    return () => clearInterval(interval)
  }, [])
  
  // Monitor department item count
  useEffect(() => {
    if (cacheScope.scope === 'department' && cacheScope.department) {
      const equipmentQuery = queryClient.getQueryData(['equipment', 'dept', cacheScope.department])
      if (Array.isArray(equipmentQuery)) {
        setMetrics(prev => ({
          ...prev,
          departmentItemCount: equipmentQuery.length,
        }))
      }
    }
  }, [queryClient, cacheScope])
  
  // Performance optimization suggestions
  const getOptimizationSuggestions = (): string[] => {
    const suggestions: string[] = []
    
    if (metrics.avgQueryTime > 1000) {
      suggestions.push('Consider adding database indexes for better query performance')
    }
    
    if (metrics.cacheHitRate < 0.8) {
      suggestions.push('Increase cache stale time to improve cache hit rate')
    }
    
    if (metrics.slowQueries > metrics.totalQueries * 0.1) {
      suggestions.push('Too many slow queries detected - review query optimization')
    }
    
    if (cacheScope.scope === 'department' && metrics.departmentItemCount > 1000) {
      suggestions.push('Large dataset detected - consider implementing pagination')
    }
    
    return suggestions
  }
  
  // Clear alerts
  const clearAlerts = () => {
    setAlerts([])
  }
  
  // Get performance summary
  const getPerformanceSummary = () => {
    const suggestions = getOptimizationSuggestions()
    
    return {
      status: suggestions.length === 0 ? 'good' : suggestions.length < 3 ? 'warning' : 'poor',
      score: Math.max(0, 100 - (suggestions.length * 20) - (metrics.slowQueries * 5)),
      suggestions,
      metrics,
      alerts: alerts.slice(0, 5), // Latest 5 alerts
    }
  }
  
  // Export performance data for debugging
  const exportPerformanceData = () => {
    const data = {
      metrics,
      alerts,
      cacheScope,
      performanceReport: performanceMonitor.current.getPerformanceReport(),
      timestamp: new Date().toISOString(),
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `department-performance-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  return {
    metrics,
    alerts,
    cacheScope,
    clearAlerts,
    getPerformanceSummary,
    getOptimizationSuggestions,
    exportPerformanceData,
    isMonitoring: cacheScope.scope !== 'none',
  }
}
