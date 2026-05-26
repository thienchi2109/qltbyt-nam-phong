import { describe, expect, it } from 'vitest'

import {
  SameOriginRequestError,
  assertSameOriginRequest,
} from '../same-origin-request'

function buildRequest(headers: HeadersInit, url = 'https://app.example.com/api/rpc/test') {
  return new Request(url, {
    method: 'POST',
    headers,
  })
}

describe('assertSameOriginRequest', () => {
  it('allows same-origin requests', () => {
    const req = buildRequest({
      origin: 'https://app.example.com',
      host: 'app.example.com',
    })

    expect(() => assertSameOriginRequest(req)).not.toThrow()
  })

  it('allows missing origin requests for legacy callers and route tests', () => {
    const req = buildRequest({
      host: 'app.example.com',
    })

    expect(() => assertSameOriginRequest(req)).not.toThrow()
  })

  it('allows default port canonical matches', () => {
    const req = buildRequest(
      {
        origin: 'https://app.example.com',
        host: 'app.example.com:443',
      },
      'https://app.example.com:443/api/rpc/test',
    )

    expect(() => assertSameOriginRequest(req)).not.toThrow()
  })

  it('rejects cross-origin requests with spoofed forwarded headers', () => {
    const req = buildRequest({
      origin: 'https://evil.example.com',
      host: 'app.example.com',
      'x-forwarded-host': 'evil.example.com',
      'x-forwarded-proto': 'https',
    })

    expect(() => assertSameOriginRequest(req)).toThrow(SameOriginRequestError)
  })

  it('rejects cross-origin requests', () => {
    const req = buildRequest({
      origin: 'https://evil.example.com',
      host: 'app.example.com',
    })

    expect(() => assertSameOriginRequest(req)).toThrow(SameOriginRequestError)
  })

  it('rejects invalid origin headers', () => {
    const req = buildRequest({
      origin: 'not a valid origin',
      host: 'app.example.com',
    })

    expect(() => assertSameOriginRequest(req)).toThrow(SameOriginRequestError)
  })

  it('ignores spoofed host headers when request URL origin matches', () => {
    const req = buildRequest({
      origin: 'https://app.example.com',
      host: 'evil.example.com',
    })

    expect(() => assertSameOriginRequest(req)).not.toThrow()
  })
})
