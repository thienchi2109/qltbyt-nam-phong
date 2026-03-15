import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeRpcToolMock = vi.fn()

vi.mock('@/lib/ai/tools/rpc-tool-executor', () => ({
  executeRpcTool: (...args: unknown[]) => executeRpcToolMock(...args),
}))

import {
  buildToolRegistry,
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
    it('maps categorySuggestion to ai_category_list RPC', () => {
      const mapping = getToolRpcMapping()
      expect(mapping.categorySuggestion).toBe('ai_category_list')
    })

    it('passes validateRequestedTools', () => {
      const result = validateRequestedTools(['categorySuggestion'])
      expect(result).toEqual({ ok: true, requestedTools: ['categorySuggestion'] })
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

      await tool.execute({})

      expect(executeRpcToolMock).toHaveBeenCalledWith(
        expect.objectContaining({
          rpcFunction: 'ai_category_list',
          args: expect.objectContaining({
            p_don_vi: 17,
            p_user_id: '42',
          }),
        }),
      )
    })
  })
})
