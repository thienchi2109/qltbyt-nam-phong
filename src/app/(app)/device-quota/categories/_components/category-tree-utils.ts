import type { CategoryListItem } from "../_types/categories"

// ============================================
// Constants
// ============================================

export const CATEGORY_ENTITY = { singular: "nhóm gốc" } as const

/** Shared grid template for column alignment across header, group rows, and child rows */
export const CATEGORY_GRID_COLS = "grid grid-cols-[minmax(0,1fr)_5rem_12rem_2rem] gap-x-4 items-center"

export const CLASSIFICATION_STYLES: Record<string, { className: string; label: string }> = {
  A: { className: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300", label: "Loại A" },
  B: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", label: "Loại B" },
}

export const SKELETON_KEYS = [
  "skel-1",
  "skel-2",
  "skel-3",
  "skel-4",
  "skel-5",
  "skel-6",
] as const

// ============================================
// Helpers
// ============================================

/** Group flat sorted list into root → children map */
export function groupByRoot(categories: CategoryListItem[]) {
  const roots: CategoryListItem[] = []
  const childrenMap = new Map<number, CategoryListItem[]>()

  for (const cat of categories) {
    if (cat.level === 1) {
      roots.push(cat)
      if (!childrenMap.has(cat.id)) {
        childrenMap.set(cat.id, [])
      }
    }
  }

  // Since the list is sorted by sort_path, track current root for children
  let currentRootId: number | null = null
  for (const cat of categories) {
    if (cat.level === 1) {
      currentRootId = cat.id
    } else if (currentRootId !== null) {
      const children = childrenMap.get(currentRootId)
      if (children) {
        children.push(cat)
      }
    }
  }

  return { roots, childrenMap }
}

// ============================================
// Aggregation Helpers
// ============================================

/**
 * Build aggregated equipment counts: each category's count =
 * its own so_luong_hien_co + sum of all descendants' so_luong_hien_co.
 *
 * Must receive the FULL category list (allCategories), not search-filtered,
 * so totals remain correct regardless of search state.
 *
 * Algorithm: the input list is depth-first ordered by sort_path,
 * so iterating in reverse guarantees children are processed before parents.
 */
export function buildAggregatedCounts(
  categories: CategoryListItem[]
): Map<number, number> {
  const totals = new Map<number, number>()

  // Seed each node with its own direct count
  for (const cat of categories) {
    totals.set(cat.id, cat.so_luong_hien_co)
  }

  // Bottom-up: iterate in reverse (depth-first order means leaves come last)
  for (let i = categories.length - 1; i >= 0; i--) {
    const cat = categories[i]
    if (cat.parent_id !== null && totals.has(cat.parent_id)) {
      totals.set(
        cat.parent_id,
        (totals.get(cat.parent_id) ?? 0) + (totals.get(cat.id) ?? 0)
      )
    }
  }

  return totals
}

/**
 * Identify leaf categories — nodes that have no children in the list.
 * A node is a leaf if no other category has parent_id === node.id.
 */
export function getLeafIds(
  categories: CategoryListItem[]
): Set<number> {
  const parentIds = new Set<number>()
  for (const cat of categories) {
    if (cat.parent_id !== null) {
      parentIds.add(cat.parent_id)
    }
  }

  const leaves = new Set<number>()
  for (const cat of categories) {
    if (!parentIds.has(cat.id)) {
      leaves.add(cat.id)
    }
  }

  return leaves
}
