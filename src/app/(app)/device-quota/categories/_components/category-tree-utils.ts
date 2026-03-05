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
