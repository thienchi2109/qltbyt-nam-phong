import { describe, expect, it } from 'vitest'

import { buildSystemPrompt } from '../system'

describe('buildSystemPrompt', () => {
  it('returns deterministic output for same input', () => {
    const context = {
      role: 'admin',
      userId: 'u1',
      selectedFacilityId: 2,
    }

    const first = buildSystemPrompt(context)
    const second = buildSystemPrompt(context)

    expect(first).toBe(second)
  })

  it('includes role and selected facility context', () => {
    const prompt = buildSystemPrompt({
      role: 'regional_leader',
      selectedFacilityId: 10,
    })

    expect(prompt).toContain('regional_leader')
    expect(prompt).toContain('10')
  })
})
