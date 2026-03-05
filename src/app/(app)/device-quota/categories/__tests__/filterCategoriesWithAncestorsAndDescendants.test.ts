import { describe, it, expect } from 'vitest'
import { filterCategoriesWithAncestorsAndDescendants } from '../_utils/filterCategoriesWithAncestorsAndDescendants'

const CATEGORIES = [
  { id: 1, parent_id: null, ma_nhom: 'G1', ten_nhom: 'Nhóm 1' },
  { id: 2, parent_id: 1,    ma_nhom: 'G1.1', ten_nhom: 'Nhóm 1.1' },
  { id: 3, parent_id: 1,    ma_nhom: 'G1.2', ten_nhom: 'Nhóm 1.2' },
  { id: 4, parent_id: 2,    ma_nhom: 'G1.1.1', ten_nhom: 'Child A' },
  { id: 5, parent_id: null, ma_nhom: 'G2', ten_nhom: 'Nhóm 2' },
  { id: 6, parent_id: 5,    ma_nhom: 'G2.1', ten_nhom: 'Nhóm 2.1' },
]

describe('filterCategoriesWithAncestorsAndDescendants', () => {
  it('returns all categories when search term is empty', () => {
    const result = filterCategoriesWithAncestorsAndDescendants(CATEGORIES, '')
    expect(result).toEqual(CATEGORIES)
  })

  it('returns all categories when search term is whitespace', () => {
    const result = filterCategoriesWithAncestorsAndDescendants(CATEGORIES, '   ')
    expect(result).toEqual(CATEGORIES)
  })

  it('includes matching item and its ancestors', () => {
    const result = filterCategoriesWithAncestorsAndDescendants(CATEGORIES, 'Child A')
    const ids = result.map(c => c.id)

    // id=4 matches, id=2 is parent, id=1 is grandparent
    expect(ids).toContain(4)
    expect(ids).toContain(2)
    expect(ids).toContain(1)

    // Unrelated root group should not be included
    expect(ids).not.toContain(5)
    expect(ids).not.toContain(6)
  })

  it('includes matching root item and all its descendants', () => {
    const result = filterCategoriesWithAncestorsAndDescendants(CATEGORIES, 'Nhóm 1')
    const ids = result.map(c => c.id)

    // id=1 matches, descendants are id=2, id=3, id=4
    expect(ids).toContain(1)
    expect(ids).toContain(2)
    expect(ids).toContain(3)
    expect(ids).toContain(4)

    // Unrelated group should not be included
    expect(ids).not.toContain(5)
    expect(ids).not.toContain(6)
  })

  it('matches on ma_nhom (case-insensitive)', () => {
    const result = filterCategoriesWithAncestorsAndDescendants(CATEGORIES, 'g2.1')
    const ids = result.map(c => c.id)

    expect(ids).toContain(6) // matched
    expect(ids).toContain(5) // ancestor
    expect(ids).not.toContain(1)
  })

  it('returns empty array when no categories match', () => {
    const result = filterCategoriesWithAncestorsAndDescendants(CATEGORIES, 'nonexistent')
    expect(result).toEqual([])
  })

  it('preserves original array order', () => {
    const result = filterCategoriesWithAncestorsAndDescendants(CATEGORIES, 'Nhóm 1')
    const ids = result.map(c => c.id)

    // Should be in same order as original
    expect(ids).toEqual([1, 2, 3, 4])
  })

  it('supports custom matcher for fields outside ma_nhom/ten_nhom (e.g. mo_ta)', () => {
    const categoriesWithDescription = [
      { id: 1, parent_id: null, ma_nhom: 'G1', ten_nhom: 'Nhóm 1', mo_ta: null },
      { id: 2, parent_id: 1, ma_nhom: 'G1.1', ten_nhom: 'Nhóm 1.1', mo_ta: 'Thiết bị nội soi' },
      { id: 3, parent_id: null, ma_nhom: 'G2', ten_nhom: 'Nhóm 2', mo_ta: 'Không liên quan' },
    ]

    const result = filterCategoriesWithAncestorsAndDescendants(
      categoriesWithDescription,
      'nội soi',
      {
        matchFn: (cat, needle) => (cat.mo_ta ?? '').toLowerCase().includes(needle),
      }
    )

    // Match id=2 by mo_ta and include its ancestor id=1
    expect(result.map(c => c.id)).toEqual([1, 2])
  })
})
