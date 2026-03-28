import { describe, expect, it } from 'vitest'

import { buildSystemPrompt } from '../system'

describe('System prompt envelope guidance (§4)', () => {
  const prompt = buildSystemPrompt({
    role: 'to_qltb',
    selectedFacilityId: 1,
    selectedFacilityName: 'Test Hospital',
  })

  it('mentions modelSummary.itemCount for count queries', () => {
    expect(prompt).toContain('modelSummary.itemCount')
  })

  it('mentions modelSummary.importantFields for data access', () => {
    expect(prompt).toContain('modelSummary.importantFields')
  })

  it('mentions summaryText', () => {
    expect(prompt).toContain('modelSummary.summaryText')
  })

  it('warns model not to reference uiArtifact in answers', () => {
    expect(prompt).toContain('uiArtifact')
    // Should instruct NOT to reference it
    expect(prompt).toMatch(/KHÔNG.*uiArtifact|uiArtifact.*giao diện/i)
  })

  it('explains envelope structure with modelSummary/followUpContext/uiArtifact', () => {
    expect(prompt).toContain('modelSummary')
    expect(prompt).toContain('followUpContext')
  })
})
