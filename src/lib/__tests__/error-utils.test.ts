import { describe, expect, it } from 'vitest'

import { getUnknownErrorMessage } from '../error-utils'

describe('getUnknownErrorMessage', () => {
  it('prefers string and Error messages over the fallback', () => {
    expect(getUnknownErrorMessage('rpc failed', 'fallback')).toBe('rpc failed')
    expect(getUnknownErrorMessage(new Error('permission denied'), 'fallback')).toBe('permission denied')
  })

  it('extracts a string message from plain objects', () => {
    expect(getUnknownErrorMessage({ message: 'plain object error' }, 'fallback')).toBe('plain object error')
  })

  it('returns the fallback when no usable message exists', () => {
    expect(getUnknownErrorMessage({ detail: 'ignored' }, 'fallback')).toBe('fallback')
    expect(getUnknownErrorMessage(null, 'fallback')).toBe('fallback')
  })
})
