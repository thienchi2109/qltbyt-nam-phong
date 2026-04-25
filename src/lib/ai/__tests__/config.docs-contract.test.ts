import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('AI config docs contract', () => {
  it('documents the preferred gateway env contract without requiring a base URL', () => {
    const envExample = readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf8')

    expect(envExample).toContain('AI_DEFAULT_CHAT_MODEL=google/gemini-3.1-flash-lite-preview')
    expect(envExample).toContain('AI_GATEWAY_API_KEY=')
    expect(envExample).toContain('AI_DEFAULT_CHAT_PROVIDER=gateway')
    expect(envExample).toContain('AI_PROVIDER=google')
    expect(envExample).toContain('AI_MODEL=gemini-3.1-flash-lite-preview')
    expect(envExample).toContain('GOOGLE_GENERATIVE_AI_API_KEY=')
    expect(envExample).toContain('GOOGLE_GENERATIVE_AI_API_KEYS=')
    expect(envExample).not.toContain('AI_BASE_URL=')
  })

  it('provides a runbook for switching providers by env and redeploy', () => {
    const runbookPath = path.resolve(process.cwd(), 'docs/ai/default-chat-config-runbook.md')
    const runbook = readFileSync(runbookPath, 'utf8')

    expect(runbook).toContain('AI_DEFAULT_CHAT_MODEL')
    expect(runbook).toContain('AI_GATEWAY_API_KEY')
    expect(runbook).toContain('AI_DEFAULT_CHAT_PROVIDER')
    expect(runbook).toContain('optional explicit pin')
    expect(runbook).toContain('<provider>/<model>')
    expect(runbook).toContain('google/')
    expect(runbook).toContain('openai/')
    expect(runbook).toContain('anthropic/')
    expect(runbook).toContain('mistral/')
    expect(runbook).toContain('GOOGLE_GENERATIVE_AI_API_KEYS')
    expect(runbook).toContain('redeploy')
    expect(runbook).not.toContain('AI_BASE_URL')
    expect(runbook).toContain(
      'AI_DEFAULT_CHAT_MODEL must be a provider-prefixed model id when provider is gateway',
    )
    expect(runbook).toContain('AI_GATEWAY_API_KEY is required for AI gateway mode')
    expect(runbook).toContain('Unsupported direct AI provider:')
  })
})
