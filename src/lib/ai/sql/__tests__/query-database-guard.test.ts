import { describe, it } from 'vitest'

describe('query_database guardrails contract', () => {
  it.todo('rejects multi-statement SQL before execution')
  it.todo('rejects statements outside SELECT / WITH ... SELECT')
  it.todo('rejects forbidden schema access outside ai_readonly')
  it.todo('rejects comment-obfuscated mutation attempts')
  it.todo('maps timeout, row, and payload limits to safe error classes')
})
