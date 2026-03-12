import { describe, expect, it } from 'vitest'
import { STARTER_PROMPT_GROUPS } from '../starter-suggestions'

describe('starter-suggestions', () => {
  it('contains a quota suggestion group', () => {
    const quotaGroup = STARTER_PROMPT_GROUPS.find((g) => g.groupKey === 'quota')
    expect(quotaGroup).toBeDefined()
    expect(quotaGroup!.suggestions.length).toBeGreaterThanOrEqual(3)
  })

  it('quota suggestions include plan-required discovery questions', () => {
    const quotaGroup = STARTER_PROMPT_GROUPS.find((g) => g.groupKey === 'quota')!
    const joined = quotaGroup.suggestions.join(' ')

    // Plan Step 2 requires these topics be discoverable
    expect(joined).toContain('định mức hiện hành')
    expect(joined).toContain('Định mức còn lại')
    expect(joined).toContain('danh mục định mức')
  })

  it('has at least equipment, quota, and maintenance groups', () => {
    const keys = STARTER_PROMPT_GROUPS.map((g) => g.groupKey)
    expect(keys).toContain('equipment')
    expect(keys).toContain('quota')
    expect(keys).toContain('maintenance')
  })

  it('each group has a non-empty label and at least one suggestion', () => {
    for (const group of STARTER_PROMPT_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0)
      expect(group.suggestions.length).toBeGreaterThan(0)
    }
  })
})
