import { describe, expect, it } from 'vitest'

import {
  GENERIC_CHAT_ERROR_MESSAGE,
  isProviderQuotaError,
  parseErrorMessage,
  sanitizeErrorForClient,
  sanitizeProviderConfigurationError,
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

  it('allowlists explicit provider configuration errors without leaking extra details', () => {
    const raw = 'Unsupported AI provider: OpenAI internal=/tmp/provider-secret stack=boom'

    expect(sanitizeProviderConfigurationError(raw)).toBe(
      'Unsupported AI provider: openai',
    )
  })

  it('keeps explicit missing Groq model configuration errors safe for clients', () => {
    const raw =
      'Missing Groq model configuration: set GROQ_MODEL internal=/tmp/provider-secret'

    expect(sanitizeProviderConfigurationError(raw)).toBe(
      'Missing Groq model configuration: set GROQ_MODEL',
    )
  })
})

describe('isProviderQuotaError', () => {
  it('returns true for "exceeded your current quota" errors', () => {
    const error = new Error(
      'You exceeded your current quota. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests',
    )
    expect(isProviderQuotaError(error)).toBe(true)
  })

  it('returns true for "generate_content_free_tier_requests" pattern', () => {
    expect(
      isProviderQuotaError(
        'quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests',
      ),
    ).toBe(true)
  })

  it('returns true for rate-limits pattern', () => {
    expect(isProviderQuotaError(new Error('rate-limits exceeded'))).toBe(true)
  })

  it('returns true for Groq rate limit reached errors', () => {
    expect(
      isProviderQuotaError(
        new Error('Rate limit reached for model in organization org_123'),
      ),
    ).toBe(true)
  })

  it('returns true for Groq 429 Too Many Requests errors', () => {
    expect(isProviderQuotaError(new Error('429 Too Many Requests'))).toBe(true)
  })

  it('returns false for generic errors', () => {
    expect(isProviderQuotaError(new Error('Network timeout'))).toBe(false)
  })

  it('returns false for Groq network timeout errors', () => {
    expect(
      isProviderQuotaError(new Error('Network timeout while contacting Groq')),
    ).toBe(false)
  })

  it('returns false for non-error values', () => {
    expect(isProviderQuotaError(null)).toBe(false)
    expect(isProviderQuotaError(undefined)).toBe(false)
    expect(isProviderQuotaError(42)).toBe(false)
  })
})

describe('sanitizeErrorForClient', () => {
  it('returns the provider quota message for Groq rate limit errors', () => {
    expect(
      sanitizeErrorForClient(
        'Rate limit reached for model in organization org_123',
      ),
    ).toContain('Model AI đang vượt hạn mức sử dụng của nhà cung cấp.')
  })
})
