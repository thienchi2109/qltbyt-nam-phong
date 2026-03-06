/**
 * Filter categories with ancestor + descendant preservation.
 *
 * Given a flat list of categories with parent_id hierarchy and a search term:
 * 1. Find all items whose ma_nhom or ten_nhom match the search needle
 * 2. Include all ancestors (preserve tree structure upward)
 * 3. Include all descendants (show full subtree downward)
 * 4. Preserve original array order
 *
 * Shared between categories page and mapping page.
 */

interface CategoryItem {
  id: number
  parent_id: number | null
  ma_nhom: string
  ten_nhom: string
}

interface FilterCategoriesOptions<T extends CategoryItem> {
  // Optional matcher to support page-specific fields (for example, `mo_ta`).
  matchFn?: (category: T, needle: string) => boolean
  /** When true (default), include all descendants of matching items. */
  includeDescendants?: boolean
}

function defaultCategoryMatch(category: CategoryItem, needle: string): boolean {
  return (
    category.ma_nhom?.toLowerCase().includes(needle) ||
    category.ten_nhom?.toLowerCase().includes(needle)
  )
}

export function filterCategoriesWithAncestorsAndDescendants<T extends CategoryItem>(
  allCategories: T[],
  searchTerm: string,
  options: FilterCategoriesOptions<T> = {}
): T[] {
  if (!searchTerm.trim()) return allCategories

  const needle = searchTerm.trim().toLowerCase()
  const matches = options.matchFn ?? defaultCategoryMatch

  // Find directly matching category IDs
  const matchingIds = new Set<number>()
  for (const cat of allCategories) {
    if (matches(cat, needle)) {
      matchingIds.add(cat.id)
    }
  }

  // Build id→item lookup
  const byId = new Map<number, T>()
  for (const cat of allCategories) byId.set(cat.id, cat)

  // Build parent→children index once to avoid rescanning all categories per parent.
  const childrenByParentId = new Map<number, number[]>()
  for (const cat of allCategories) {
    if (cat.parent_id == null) continue
    const siblings = childrenByParentId.get(cat.parent_id)
    if (siblings) {
      siblings.push(cat.id)
    } else {
      childrenByParentId.set(cat.parent_id, [cat.id])
    }
  }

  const visibleIds = new Set(matchingIds)

  // Include ancestors (preserve tree structure)
  for (const id of matchingIds) {
    let current = byId.get(id)
    while (current?.parent_id != null) {
      if (visibleIds.has(current.parent_id)) break
      visibleIds.add(current.parent_id)
      current = byId.get(current.parent_id)
    }
  }

  // Include descendants (show full subtree of matching items) — opt-out via options
  if (options.includeDescendants !== false) {
    const stack = [...matchingIds]
    while (stack.length > 0) {
      const parentId = stack.pop()!
      const childIds = childrenByParentId.get(parentId)
      if (!childIds) continue

      for (const childId of childIds) {
        if (visibleIds.has(childId)) continue
        visibleIds.add(childId)
        stack.push(childId)
      }
    }
  }

  return allCategories.filter(cat => visibleIds.has(cat.id))
}
