import { describe, expect, it } from 'vitest'

import { maxDuration, runtime } from '../route'

describe('/api/chat route runtime configuration', () => {
  it('uses the nodejs runtime', () => {
    expect(runtime).toBe('nodejs')
  })

  it('allows up to 60 seconds for chat requests', () => {
    expect(maxDuration).toBe(60)
  })
})
