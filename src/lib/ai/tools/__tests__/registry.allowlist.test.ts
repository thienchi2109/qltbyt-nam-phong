import { describe, expect, it } from 'vitest'

import { getAllowedToolNamesForTest, validateRequestedTools } from '../registry'

describe('registry allowlist contract', () => {
  it('does not expose query_database in the current assistant allowlist', () => {
    const allowedToolNames = getAllowedToolNamesForTest()

    expect(allowedToolNames).not.toContain('query_database')
    expect(allowedToolNames).not.toContain('queryDatabase')
  })

  it('rejects query_database before runtime rollout exists', () => {
    expect(validateRequestedTools(['query_database'])).toEqual({
      ok: false,
      message: 'Unknown tool requested: query_database',
    })
  })
})
