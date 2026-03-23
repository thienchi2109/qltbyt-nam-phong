import { describe, expect, it } from 'vitest'
import { STARTER_PROMPT_GROUPS, PINNED_PROMPTS } from '../starter-suggestions'

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

  it('exports exactly 2 pinned prompts', () => {
    expect(PINNED_PROMPTS).toHaveLength(2)
  })

  it('pinned prompts do not overlap with group suggestions', () => {
    const allGroupSuggestions = STARTER_PROMPT_GROUPS.flatMap((g) => g.suggestions)
    for (const pinned of PINNED_PROMPTS) {
      expect(allGroupSuggestions).not.toContain(pinned)
    }
  })

  it('pinned prompts contain the expected texts', () => {
    expect(PINNED_PROMPTS).toContain('Gợi ý gán thiết bị vào danh mục định mức của đơn vị')
    expect(PINNED_PROMPTS).toContain('Tạo phiếu yêu cầu sửa chữa thiết bị')
  })
})
