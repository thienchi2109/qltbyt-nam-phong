import { readFileSync } from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeRpcToolMock = vi.fn()

vi.mock('@/lib/ai/tools/rpc-tool-executor', () => ({
  executeRpcTool: (...args: unknown[]) => executeRpcToolMock(...args),
}))

import {
  buildToolRegistry,
  READ_ONLY_TOOL_DEFINITIONS_FOR_TEST,
  validateRequestedTools,
  getToolRpcMapping,
} from '../registry'

type ExecutableTool = {
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

describe('categorySuggestion tool', () => {
  beforeEach(() => {
    executeRpcToolMock.mockReset()
    executeRpcToolMock.mockResolvedValue({ data: [] })
  })

  describe('registry contract', () => {
    it('maps categorySuggestion to ai_category_suggestion RPC', () => {
      const mapping = getToolRpcMapping()
      expect(mapping.categorySuggestion).toBe('ai_category_suggestion')
    })

    it('passes validateRequestedTools', () => {
      const result = validateRequestedTools(['categorySuggestion'])
      expect(result).toEqual({ ok: true, requestedTools: ['categorySuggestion'] })
    })

    it('requires device_name and rejects unknown fields', () => {
      const schema = READ_ONLY_TOOL_DEFINITIONS_FOR_TEST.categorySuggestion
        .inputSchema as import('zod').ZodObject<Record<string, unknown>>

      expect(schema.safeParse({ device_name: 'bàn mổ' }).success).toBe(true)
      expect(schema.safeParse({}).success).toBe(false)
      expect(schema.safeParse({ device_name: '' }).success).toBe(false)
      expect(
        schema.safeParse({
          device_name: 'bàn mổ',
          extra: true,
        }).success,
      ).toBe(false)
    })

    it('has a migration that defines ai_category_suggestion with bounded candidate retrieval', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20260328113000_add_ai_category_suggestion_rpc.sql',
      )
      const migrationSource = readFileSync(migrationPath, 'utf8')

      expect(migrationSource).toContain(
        'CREATE OR REPLACE FUNCTION public.ai_category_suggestion',
      )
      expect(migrationSource).toContain('p_device_name TEXT')
      expect(migrationSource).toContain('p_top_k INTEGER DEFAULT 10')
      expect(migrationSource).toContain("plainto_tsquery('simple'")
      expect(migrationSource).toContain('word_similarity')
      expect(migrationSource).toMatch(/LIMIT\s+v_top_k/i)
    })
  })

  describe('buildToolRegistry wiring', () => {
    it('injects p_don_vi and p_user_id into RPC call', async () => {
      const registry = buildToolRegistry({
        request: new Request('http://localhost:3000/api/chat', { method: 'POST' }),
        tenantId: 17,
        userId: '42',
        requestedTools: ['categorySuggestion'],
      })

      const tool = registry.categorySuggestion as unknown as ExecutableTool
      expect(tool).toBeDefined()

      await tool.execute({ device_name: 'bàn mổ' })

      expect(executeRpcToolMock).toHaveBeenCalledWith(
        expect.objectContaining({
          rpcFunction: 'ai_category_suggestion',
          args: expect.objectContaining({
            p_device_name: 'bàn mổ',
            p_don_vi: 17,
            p_user_id: '42',
          }),
        }),
      )
    })
  })
})
