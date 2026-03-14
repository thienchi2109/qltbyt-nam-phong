import { describe, expect, it } from 'vitest'

import {
  GENERIC_CHAT_ERROR_MESSAGE,
  parseErrorMessage,
  sanitizeErrorForClient,
} from '../errors'

describe('ai errors sanitization', () => {
  it('normalizes safe plain-text rate limit messages instead of echoing appended raw details', () => {
    const raw =
      'Too many requests. Please try again later. requestId=req_123 internal=provider-stack'

    expect(sanitizeErrorForClient(raw)).toBe(
      'Too many requests. Please try again later.',
    )
    expect(parseErrorMessage(raw)).toBe(
      'Too many requests. Please try again later.',
    )
  })

  it('normalizes safe JSON-wrapped quota messages instead of leaking appended details', () => {
    const raw = JSON.stringify({
      error:
        'AI usage quota exceeded for this facility. requestId=req_123 internal=provider-stack',
    })

    expect(parseErrorMessage(raw)).toBe(
      'AI usage quota exceeded for this facility.',
    )
  })

  it('keeps deny-by-default for unexpected raw strings', () => {
    const raw = 'Unhandled provider exception: stack=abc123'

    expect(sanitizeErrorForClient(raw)).toBe(GENERIC_CHAT_ERROR_MESSAGE)
  })
})
