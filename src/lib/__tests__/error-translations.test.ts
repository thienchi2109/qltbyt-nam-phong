import { describe, it, expect } from 'vitest'

import { translateRpcError } from '../error-translations'

describe('translateRpcError', () => {
  it('translates permission denied', () => {
    expect(translateRpcError('permission denied for table')).toBe('Không có quyền thực hiện')
  })

  it('translates duplicate category code', () => {
    expect(translateRpcError('duplicate key value violates unique constraint')).toBe('Mã nhóm đã tồn tại trong đơn vị')
  })

  it('translates parent category errors', () => {
    expect(translateRpcError('Parent category not found.')).toBe('Không tìm thấy nhóm cha')
  })

  it('truncates unknown errors', () => {
    const longMsg = 'x'.repeat(200)
    expect(translateRpcError(longMsg)).toHaveLength(83)
  })
})
