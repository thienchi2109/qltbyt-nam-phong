"use client"

import type { DensityMode } from "@/components/transfers/DensityToggle"
import type { TransferStatus } from "@/components/transfers/CollapsibleLane"

// LocalStorage keys
export const STORAGE_KEYS = {
  DENSITY_MODE: 'transfers-density-mode',
  LANE_COLLAPSED: 'transfers-lane-collapsed',
  VISIBLE_COUNTS: 'transfers-visible-counts',
} as const

// Type definitions
export type LaneCollapsedState = Record<TransferStatus, boolean>
export type VisibleCountsState = Record<TransferStatus, number>

// Helper to check if we're on client-side
const isClient = typeof window !== 'undefined'

// ============================================================================
// Density Mode Persistence
// ============================================================================

export function getDensityMode(): DensityMode {
  if (!isClient) return 'compact'
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DENSITY_MODE)
    if (stored === 'compact' || stored === 'rich') {
      return stored
    }
  } catch (error) {
    console.error('Error reading density mode from localStorage:', error)
  }
  
  return 'compact' // Default
}

export function setDensityMode(mode: DensityMode): void {
  if (!isClient) return
  
  try {
    localStorage.setItem(STORAGE_KEYS.DENSITY_MODE, mode)
  } catch (error) {
    console.error('Error saving density mode to localStorage:', error)
  }
}

// ============================================================================
// Lane Collapsed State Persistence
// ============================================================================

export function getLaneCollapsedState(): LaneCollapsedState {
  if (!isClient) {
    // Default: Collapse hoan_thanh (Done/Archive)
    return {
      cho_duyet: false,
      da_duyet: false,
      dang_luan_chuyen: false,
      da_ban_giao: false,
      hoan_thanh: true, // Auto-collapse completed
    }
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LANE_COLLAPSED)
    if (stored) {
      const parsed = JSON.parse(stored) as LaneCollapsedState
      return parsed
    }
  } catch (error) {
    console.error('Error reading lane collapsed state from localStorage:', error)
  }
  
  // Default state
  return {
    cho_duyet: false,
    da_duyet: false,
    dang_luan_chuyen: false,
    da_ban_giao: false,
    hoan_thanh: true, // Auto-collapse completed
  }
}

export function setLaneCollapsedState(state: LaneCollapsedState): void {
  if (!isClient) return
  
  try {
    localStorage.setItem(STORAGE_KEYS.LANE_COLLAPSED, JSON.stringify(state))
  } catch (error) {
    console.error('Error saving lane collapsed state to localStorage:', error)
  }
}

// ============================================================================
// Visible Counts Persistence
// ============================================================================

const DEFAULT_VISIBLE_COUNT = 50

export function getVisibleCounts(): VisibleCountsState {
  if (!isClient) {
    return {
      cho_duyet: DEFAULT_VISIBLE_COUNT,
      da_duyet: DEFAULT_VISIBLE_COUNT,
      dang_luan_chuyen: DEFAULT_VISIBLE_COUNT,
      da_ban_giao: DEFAULT_VISIBLE_COUNT,
      hoan_thanh: DEFAULT_VISIBLE_COUNT,
    }
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.VISIBLE_COUNTS)
    if (stored) {
      const parsed = JSON.parse(stored) as VisibleCountsState
      return parsed
    }
  } catch (error) {
    console.error('Error reading visible counts from localStorage:', error)
  }
  
  // Default state
  return {
    cho_duyet: DEFAULT_VISIBLE_COUNT,
    da_duyet: DEFAULT_VISIBLE_COUNT,
    dang_luan_chuyen: DEFAULT_VISIBLE_COUNT,
    da_ban_giao: DEFAULT_VISIBLE_COUNT,
    hoan_thanh: DEFAULT_VISIBLE_COUNT,
  }
}

export function setVisibleCounts(counts: VisibleCountsState): void {
  if (!isClient) return
  
  try {
    localStorage.setItem(STORAGE_KEYS.VISIBLE_COUNTS, JSON.stringify(counts))
  } catch (error) {
    console.error('Error saving visible counts to localStorage:', error)
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clear all Kanban preferences (useful for debugging or reset)
 */
export function clearKanbanPreferences(): void {
  if (!isClient) return
  
  try {
    localStorage.removeItem(STORAGE_KEYS.DENSITY_MODE)
    localStorage.removeItem(STORAGE_KEYS.LANE_COLLAPSED)
    localStorage.removeItem(STORAGE_KEYS.VISIBLE_COUNTS)
  } catch (error) {
    console.error('Error clearing Kanban preferences:', error)
  }
}

/**
 * Get all Kanban preferences at once
 */
export function getAllKanbanPreferences() {
  return {
    densityMode: getDensityMode(),
    laneCollapsed: getLaneCollapsedState(),
    visibleCounts: getVisibleCounts(),
  }
}
