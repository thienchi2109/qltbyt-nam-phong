import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('RepairRequests assistant draft handoff', () => {
  it('bridges assistant draft cache into the create sheet flow', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx'),
      'utf8',
    )

    expect(source).toContain('queryClient.getQueryData(["assistant-draft"])')
    expect(source).toMatch(
      /applyAssistantDraft\(\s*cachedAssistantDraft(?:\s+as\s+Parameters<typeof applyAssistantDraft>\[0\])?\s*\)/
    )
    expect(source).toContain('openCreateSheet()')
    expect(source).toContain('queryClient.removeQueries({ queryKey: ["assistant-draft"] })')
  })
})
