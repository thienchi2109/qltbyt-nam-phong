import * as BulkImportModule from '@/components/bulk-import'

describe('bulk import public API surface', () => {
  it('does not expose translateBulkImportError helper through the barrel', () => {
    expect('translateBulkImportError' in BulkImportModule).toBe(false)
  })

  it('does not expose formatImportResultErrors helper through the barrel', () => {
    expect('formatImportResultErrors' in BulkImportModule).toBe(false)
  })
})
