import * as BulkImportModule from '@/components/bulk-import'

describe('bulk import public API surface', () => {
  it('exposes the expected public exports', () => {
    expect('useBulkImportState' in BulkImportModule).toBe(true)
    expect('BulkImportFileInput' in BulkImportModule).toBe(true)
    expect('BulkImportErrorAlert' in BulkImportModule).toBe(true)
    expect('BulkImportValidationErrors' in BulkImportModule).toBe(true)
    expect('BulkImportSuccessMessage' in BulkImportModule).toBe(true)
    expect('BulkImportSubmitButton' in BulkImportModule).toBe(true)
    expect('buildImportToastMessage' in BulkImportModule).toBe(true)
  })

  it('does not expose translateBulkImportError helper through the barrel', () => {
    expect('translateBulkImportError' in BulkImportModule).toBe(false)
  })

  it('does not expose formatImportResultErrors helper through the barrel', () => {
    expect('formatImportResultErrors' in BulkImportModule).toBe(false)
  })
})
