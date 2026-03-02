import * as PaginationModule from '@/components/shared/DataTablePagination'

describe('DataTablePagination barrel public API', () => {
  it('exposes DataTablePagination component', () => {
    expect('DataTablePagination' in PaginationModule).toBe(true)
  })

  it.each([
    'DataTablePaginationProps',
    'EntityLabels',
    'DisplayFormat',
    'PaginationMode',
    'ResponsiveConfig',
    'DisplayContext',
  ])('does not expose %s as runtime exports', (name) => {
    expect(name in PaginationModule).toBe(false)
  })
})
