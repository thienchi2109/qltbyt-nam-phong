import * as PaginationModule from '@/components/shared/DataTablePagination'

describe('DataTablePagination barrel public API', () => {
  it('exposes only DataTablePagination at runtime', () => {
    const runtimeExports = Object.keys(PaginationModule)

    expect(runtimeExports).toContain('DataTablePagination')
    expect(runtimeExports).toHaveLength(1)
  })
})
