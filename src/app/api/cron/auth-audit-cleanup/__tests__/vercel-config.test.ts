import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Vercel cron configuration for auth audit cleanup', () => {
  it('schedules the auth audit cleanup route weekly', () => {
    const configPath = path.resolve(process.cwd(), 'vercel.json')
    expect(fs.existsSync(configPath)).toBe(true)

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      crons?: Array<{ path?: string; schedule?: string }>
    }

    expect(config.crons).toContainEqual({
      path: '/api/cron/auth-audit-cleanup',
      schedule: '0 3 * * 0',
    })
  })
})
