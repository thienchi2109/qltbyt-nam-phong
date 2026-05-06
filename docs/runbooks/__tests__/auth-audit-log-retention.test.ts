import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('auth audit log retention runbook', () => {
  it('does not tell operators to comment JSON cron config', () => {
    const runbookPath = path.resolve(
      process.cwd(),
      'docs/runbooks/auth-audit-log-retention.md'
    )
    const runbook = fs.readFileSync(runbookPath, 'utf8')

    expect(runbook).not.toMatch(/comment entry .*vercel\.json/i)
  })
})
