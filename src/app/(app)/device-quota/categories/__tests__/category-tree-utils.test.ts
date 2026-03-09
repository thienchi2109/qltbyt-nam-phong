import { describe, it, expect } from 'vitest'

import { buildAggregatedCounts, getLeafIds } from '../_components/category-tree-utils'
import type { CategoryListItem } from '../_types/categories'

/**
 * Factory for creating test CategoryListItem objects with sensible defaults.
 * Only fields relevant to aggregation are required.
 */
function makeCat(overrides: Partial<CategoryListItem> & Pick<CategoryListItem, 'id' | 'level'>): CategoryListItem {
  return {
    parent_id: null,
    ma_nhom: `CAT-${overrides.id}`,
    ten_nhom: `Category ${overrides.id}`,
    phan_loai: null,
    don_vi_tinh: null,
    thu_tu_hien_thi: 0,
    so_luong_hien_co: 0,
    so_luong_toi_da: null,
    so_luong_toi_thieu: null,
    ...overrides,
  }
}

// ============================================
// buildAggregatedCounts
// ============================================

describe('buildAggregatedCounts', () => {
  it('aggregates leaf counts up through a 3-level tree', () => {
    // Tree structure (depth-first sorted):
    //   1 (root, L1)
    //     2 (intermediate, L2)
    //       4 (leaf, L3, count=2)
    //       5 (leaf, L3, count=3)
    //     3 (intermediate, L2)
    //       6 (leaf, L3, count=1)
    const categories: CategoryListItem[] = [
      makeCat({ id: 1, level: 1 }),
      makeCat({ id: 2, level: 2, parent_id: 1 }),
      makeCat({ id: 4, level: 3, parent_id: 2, so_luong_hien_co: 2 }),
      makeCat({ id: 5, level: 3, parent_id: 2, so_luong_hien_co: 3 }),
      makeCat({ id: 3, level: 2, parent_id: 1 }),
      makeCat({ id: 6, level: 3, parent_id: 3, so_luong_hien_co: 1 }),
    ]

    const counts = buildAggregatedCounts(categories)

    // Leaves keep their own counts
    expect(counts.get(4)).toBe(2)
    expect(counts.get(5)).toBe(3)
    expect(counts.get(6)).toBe(1)

    // Intermediate = sum of children
    expect(counts.get(2)).toBe(5) // 2 + 3
    expect(counts.get(3)).toBe(1)

    // Root = sum of all descendants
    expect(counts.get(1)).toBe(6) // 2 + 3 + 1
  })

  it('returns raw counts for a single-level tree (all roots)', () => {
    const categories: CategoryListItem[] = [
      makeCat({ id: 10, level: 1, so_luong_hien_co: 7 }),
      makeCat({ id: 11, level: 1, so_luong_hien_co: 4 }),
    ]

    const counts = buildAggregatedCounts(categories)

    expect(counts.get(10)).toBe(7)
    expect(counts.get(11)).toBe(4)
  })

  it('returns an empty map for an empty tree', () => {
    const counts = buildAggregatedCounts([])

    expect(counts.size).toBe(0)
  })
})

// ============================================
// getLeafIds
// ============================================

describe('getLeafIds', () => {
  it('identifies leaf nodes (nodes with no children)', () => {
    const categories: CategoryListItem[] = [
      makeCat({ id: 1, level: 1 }),
      makeCat({ id: 2, level: 2, parent_id: 1 }),
      makeCat({ id: 4, level: 3, parent_id: 2 }),
      makeCat({ id: 5, level: 3, parent_id: 2 }),
      makeCat({ id: 3, level: 2, parent_id: 1 }),
      makeCat({ id: 6, level: 3, parent_id: 3 }),
    ]

    const leaves = getLeafIds(categories)

    // Only level 3 nodes are leaves
    expect(leaves.has(4)).toBe(true)
    expect(leaves.has(5)).toBe(true)
    expect(leaves.has(6)).toBe(true)

    // Roots and intermediates are NOT leaves
    expect(leaves.has(1)).toBe(false)
    expect(leaves.has(2)).toBe(false)
    expect(leaves.has(3)).toBe(false)
  })

  it('treats all roots as leaves when no children exist', () => {
    const categories: CategoryListItem[] = [
      makeCat({ id: 10, level: 1 }),
      makeCat({ id: 11, level: 1 }),
    ]

    const leaves = getLeafIds(categories)

    expect(leaves.has(10)).toBe(true)
    expect(leaves.has(11)).toBe(true)
  })

  it('returns an empty set for an empty tree', () => {
    const leaves = getLeafIds([])

    expect(leaves.size).toBe(0)
  })
})
