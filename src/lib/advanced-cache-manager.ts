/**
 * Phase 3: Advanced Cache Manager for Department Filtering
 * 
 * This module provides sophisticated caching strategies for department-based filtering,
 * including hierarchical cache invalidation, performance monitoring, and smart prefetching.
 */

import { QueryClient } from '@tanstack/react-query'
import type { User } from '@/types/database'

// Cache configuration constants
export const CACHE_CONFIG = {
  // Stale times for different data types
  EQUIPMENT_STALE_TIME: 5 * 60 * 1000, // 5 minutes
  REPAIR_REQUESTS_STALE_TIME: 2 * 60 * 1000, // 2 minutes
  USER_DATA_STALE_TIME: 10 * 60 * 1000, // 10 minutes
  LOOKUP_DATA_STALE_TIME: 15 * 60 * 1000, // 15 minutes
  
  // Garbage collection times
  EQUIPMENT_GC_TIME: 30 * 60 * 1000, // 30 minutes
  REPAIR_REQUESTS_GC_TIME: 15 * 60 * 1000, // 15 minutes
  USER_DATA_GC_TIME: 60 * 60 * 1000, // 1 hour
  
  // Prefetch settings
  PREFETCH_DELAY: 100, // ms
  MAX_PREFETCH_ITEMS: 5,
} as const

// Cache key generators with department awareness
export const CacheKeys = {
  // Equipment cache keys
  equipment: {
    all: (userDepartment?: string) => 
      userDepartment ? ['equipment', 'dept', userDepartment] : ['equipment', 'all'],
    list: (filters: Record<string, any>, userDepartment?: string) => [
      ...CacheKeys.equipment.all(userDepartment), 
      'list', 
      { filters, department: userDepartment }
    ],
    detail: (id: string) => ['equipment', 'detail', id],
    search: (query: string, userDepartment?: string) => [
      ...CacheKeys.equipment.all(userDepartment),
      'search',
      query
    ],
  },
  
  // Repair requests cache keys
  repairRequests: {
    all: (userDepartment?: string) => 
      userDepartment ? ['repair-requests', 'dept', userDepartment] : ['repair-requests', 'all'],
    list: (filters: Record<string, any>, userDepartment?: string) => [
      ...CacheKeys.repairRequests.all(userDepartment),
      'list',
      { filters, department: userDepartment }
    ],
    detail: (id: string) => ['repair-requests', 'detail', id],
  },
  
  // User and department cache keys
  user: {
    current: () => ['user', 'current'],
    department: (department: string) => ['user', 'department', department],
    permissions: (userId: string) => ['user', 'permissions', userId],
  },
  
  // Dashboard and statistics
  dashboard: {
    stats: (userDepartment?: string) => 
      userDepartment ? ['dashboard', 'stats', 'dept', userDepartment] : ['dashboard', 'stats', 'all'],
    kpis: (userDepartment?: string) => [
      ...CacheKeys.dashboard.stats(userDepartment),
      'kpis'
    ],
  },
} as const

// Cache invalidation patterns
export const InvalidationPatterns = {
  // Invalidate all equipment-related caches
  equipment: (queryClient: QueryClient, userDepartment?: string) => {
    queryClient.invalidateQueries({ 
      queryKey: CacheKeys.equipment.all(userDepartment) 
    })
    queryClient.invalidateQueries({ 
      queryKey: CacheKeys.dashboard.stats(userDepartment) 
    })
  },
  
  // Invalidate repair requests caches
  repairRequests: (queryClient: QueryClient, userDepartment?: string) => {
    queryClient.invalidateQueries({ 
      queryKey: CacheKeys.repairRequests.all(userDepartment) 
    })
    queryClient.invalidateQueries({ 
      queryKey: CacheKeys.dashboard.stats(userDepartment) 
    })
  },
  
  // Invalidate all department-specific caches
  department: (queryClient: QueryClient, department: string) => {
    queryClient.invalidateQueries({ 
      queryKey: ['equipment', 'dept', department] 
    })
    queryClient.invalidateQueries({ 
      queryKey: ['repair-requests', 'dept', department] 
    })
    queryClient.invalidateQueries({ 
      queryKey: ['dashboard', 'stats', 'dept', department] 
    })
  },
  
  // Nuclear option - clear all caches
  all: (queryClient: QueryClient) => {
    queryClient.clear()
  },
} as const

// Smart prefetching utilities
export class SmartPrefetcher {
  private queryClient: QueryClient
  private prefetchQueue: Set<string> = new Set()
  
  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
  }
  
  // Prefetch related equipment data when user views equipment list
  async prefetchEquipmentRelated(userDepartment?: string) {
    if (!userDepartment) return
    
    const prefetchKey = `equipment-related-${userDepartment}`
    if (this.prefetchQueue.has(prefetchKey)) return
    
    this.prefetchQueue.add(prefetchKey)
    
    try {
      // Prefetch repair requests for the same department
      await this.queryClient.prefetchQuery({
        queryKey: CacheKeys.repairRequests.all(userDepartment),
        staleTime: CACHE_CONFIG.REPAIR_REQUESTS_STALE_TIME,
      })
      
      // Prefetch dashboard stats
      await this.queryClient.prefetchQuery({
        queryKey: CacheKeys.dashboard.stats(userDepartment),
        staleTime: CACHE_CONFIG.EQUIPMENT_STALE_TIME,
      })
    } finally {
      setTimeout(() => {
        this.prefetchQueue.delete(prefetchKey)
      }, CACHE_CONFIG.PREFETCH_DELAY)
    }
  }
  
  // Prefetch equipment details when hovering over equipment cards
  async prefetchEquipmentDetail(equipmentId: string) {
    const prefetchKey = `equipment-detail-${equipmentId}`
    if (this.prefetchQueue.has(prefetchKey)) return
    
    this.prefetchQueue.add(prefetchKey)
    
    try {
      await this.queryClient.prefetchQuery({
        queryKey: CacheKeys.equipment.detail(equipmentId),
        staleTime: CACHE_CONFIG.EQUIPMENT_STALE_TIME,
      })
    } finally {
      setTimeout(() => {
        this.prefetchQueue.delete(prefetchKey)
      }, CACHE_CONFIG.PREFETCH_DELAY)
    }
  }
}

// Performance monitoring utilities
export class CachePerformanceMonitor {
  private metrics: Map<string, {
    hits: number
    misses: number
    lastAccess: number
    avgResponseTime: number
  }> = new Map()
  
  recordCacheHit(cacheKey: string, responseTime: number) {
    const key = this.normalizeKey(cacheKey)
    const existing = this.metrics.get(key) || { hits: 0, misses: 0, lastAccess: 0, avgResponseTime: 0 }
    
    existing.hits++
    existing.lastAccess = Date.now()
    existing.avgResponseTime = (existing.avgResponseTime + responseTime) / 2
    
    this.metrics.set(key, existing)
  }
  
  recordCacheMiss(cacheKey: string) {
    const key = this.normalizeKey(cacheKey)
    const existing = this.metrics.get(key) || { hits: 0, misses: 0, lastAccess: 0, avgResponseTime: 0 }
    
    existing.misses++
    existing.lastAccess = Date.now()
    
    this.metrics.set(key, existing)
  }
  
  getPerformanceReport() {
    const report = Array.from(this.metrics.entries()).map(([key, metrics]) => ({
      cacheKey: key,
      hitRate: metrics.hits / (metrics.hits + metrics.misses),
      totalRequests: metrics.hits + metrics.misses,
      avgResponseTime: metrics.avgResponseTime,
      lastAccess: new Date(metrics.lastAccess).toISOString(),
    }))
    
    return report.sort((a, b) => b.totalRequests - a.totalRequests)
  }
  
  private normalizeKey(cacheKey: string | string[]): string {
    return Array.isArray(cacheKey) ? cacheKey.join(':') : cacheKey
  }
}

// Department-aware cache utilities
export const DepartmentCacheUtils = {
  // Get user's cache scope based on role and department
  getUserCacheScope(user: User | null): {
    department?: string
    scope: 'global' | 'department' | 'none'
  } {
    if (!user) return { scope: 'none' }
    
    if (['admin', 'to_qltb'].includes(user.role)) {
      return { scope: 'global' }
    }
    
    if (user.khoa_phong) {
      return { 
        department: user.khoa_phong,
        scope: 'department' 
      }
    }
    
    return { scope: 'none' }
  },
  
  // Warm up cache for a specific department
  async warmUpDepartmentCache(
    queryClient: QueryClient, 
    department: string,
    prefetcher: SmartPrefetcher
  ) {
    console.log(`[CacheManager] Warming up cache for department: ${department}`)
    
    try {
      await prefetcher.prefetchEquipmentRelated(department)
      console.log(`[CacheManager] Cache warmed up successfully for ${department}`)
    } catch (error) {
      console.error(`[CacheManager] Failed to warm up cache for ${department}:`, error)
    }
  },
  
  // Clean up stale department caches
  cleanupStaleCaches(queryClient: QueryClient, activeDepartments: string[]) {
    const allQueries = queryClient.getQueryCache().getAll()
    
    allQueries.forEach(query => {
      const key = query.queryKey
      if (Array.isArray(key) && key.includes('dept')) {
        const deptIndex = key.indexOf('dept')
        const department = key[deptIndex + 1]
        
        if (department && !activeDepartments.includes(department)) {
          queryClient.removeQueries({ queryKey: key })
          console.log(`[CacheManager] Cleaned up stale cache for department: ${department}`)
        }
      }
    })
  },
}

// Export singleton instances
export const createAdvancedCacheManager = (queryClient: QueryClient) => ({
  prefetcher: new SmartPrefetcher(queryClient),
  monitor: new CachePerformanceMonitor(),
  utils: DepartmentCacheUtils,
  keys: CacheKeys,
  invalidation: InvalidationPatterns,
  config: CACHE_CONFIG,
})
