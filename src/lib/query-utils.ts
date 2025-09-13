import { QueryClient } from '@tanstack/react-query'

// Cache invalidation utilities
export class CacheManager {
  constructor(private queryClient: QueryClient) {}

  // Invalidate all equipment-related caches
  invalidateEquipment() {
    this.queryClient.invalidateQueries({ queryKey: ['equipment'] })
    this.queryClient.invalidateQueries({ queryKey: ['reports'] })
    this.queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  // Invalidate transfer-related caches
  invalidateTransfers() {
    this.queryClient.invalidateQueries({ queryKey: ['transfers'] })
    this.queryClient.invalidateQueries({ queryKey: ['reports'] })
    this.queryClient.invalidateQueries({ queryKey: ['equipment'] })
  }

  // Invalidate maintenance caches
  invalidateMaintenance() {
    this.queryClient.invalidateQueries({ queryKey: ['maintenance'] })
    this.queryClient.invalidateQueries({ queryKey: ['reports'] })
    this.queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  // Invalidate repair caches
  invalidateRepair() {
    this.queryClient.invalidateQueries({ queryKey: ['repair'] })
    this.queryClient.invalidateQueries({ queryKey: ['reports'] })
    this.queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  // Invalidate lookup data (when departments, types, or users change)
  invalidateLookups() {
    this.queryClient.invalidateQueries({ queryKey: ['departments'] })
    this.queryClient.invalidateQueries({ queryKey: ['equipment-types'] })
    this.queryClient.invalidateQueries({ queryKey: ['profiles'] })
  }

  // Clear all caches (use sparingly)
  clearAll() {
    this.queryClient.clear()
  }
} 