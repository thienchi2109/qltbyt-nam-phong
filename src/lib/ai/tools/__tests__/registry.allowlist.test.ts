import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { getAllowedToolNamesForTest, validateRequestedTools } from '../registry'

describe('registry allowlist contract', () => {
  it('exposes query_database in the assistant allowlist', () => {
    const allowedToolNames = getAllowedToolNamesForTest()

    expect(allowedToolNames).toContain('query_database')
    expect(allowedToolNames).not.toContain('queryDatabase')
  })

  it('accepts query_database for the runtime rollout', () => {
    expect(validateRequestedTools(['query_database'])).toEqual({
      ok: true,
      requestedTools: ['query_database'],
    })
  })

  it('rejects queryDatabase before runtime rollout exists', () => {
    expect(validateRequestedTools(['queryDatabase'])).toEqual({
      ok: false,
      message: 'Unknown tool requested: queryDatabase',
    })
  })
})
