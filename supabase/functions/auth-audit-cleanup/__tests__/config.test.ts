import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('auth-audit-cleanup Supabase function config', () => {
  it('disables platform JWT verification for cron-secret auth fallback', () => {
    const configPath = path.resolve(process.cwd(), 'supabase/config.toml')
    const config = fs.readFileSync(configPath, 'utf8')

    expect(config).toMatch(
      /\[functions\.auth-audit-cleanup\][\s\S]*?verify_jwt\s*=\s*false/
    )
  })
})
