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

export function filterCategoriesWithAncestorsAndDescendants<T extends CategoryItem>(
  allCategories: T[],
  searchTerm: string
): T[] {
  if (!searchTerm.trim()) return allCategories

  const needle = searchTerm.trim().toLowerCase()

  // Find directly matching category IDs
  const matchingIds = new Set<number>()
  for (const cat of allCategories) {
    if (
      cat.ma_nhom?.toLowerCase().includes(needle) ||
      cat.ten_nhom?.toLowerCase().includes(needle)
    ) {
      matchingIds.add(cat.id)
    }
  }

  // Build id→item lookup
  const byId = new Map<number, T>()
  for (const cat of allCategories) byId.set(cat.id, cat)

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

  // Include descendants (show full subtree of matching items)
  const stack = [...matchingIds]
  while (stack.length > 0) {
    const parentId = stack.pop()!
    for (const cat of allCategories) {
      if (cat.parent_id === parentId && !visibleIds.has(cat.id)) {
        visibleIds.add(cat.id)
        stack.push(cat.id)
      }
    }
  }

  return allCategories.filter(cat => visibleIds.has(cat.id))
}
