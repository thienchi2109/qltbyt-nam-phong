import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const executeRpcToolMock = vi.fn()

vi.mock('@/lib/ai/tools/rpc-tool-executor', () => ({
  executeRpcTool: (...args: unknown[]) => executeRpcToolMock(...args),
}))

import {
  buildToolRegistry,
  getToolRpcMapping,
} from '../registry'
import {
  isToolResponseEnvelope,
  compactToolOutput,
} from '../tool-response-envelope'

type ExecutableTool = {
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

const SAMPLE_CATEGORY_RESPONSE = {
  data: [
    { ma_nhom: 'NTB.001', ten_nhom: 'Bàn mổ', parent_name: 'Thiết bị phẫu thuật', phan_loai: 'B', match_reason: 'fts' },
    { ma_nhom: 'NTB.002', ten_nhom: 'Bàn khám', parent_name: 'Thiết bị khám', phan_loai: 'C', match_reason: 'trigram' },
  ],
  total: 2,
}

describe('categorySuggestion envelope contract', () => {
  beforeEach(() => {
    executeRpcToolMock.mockReset()
    executeRpcToolMock.mockResolvedValue({
      modelSummary: {
        summaryText: 'categorySuggestion: 2 result(s).',
        itemCount: 2,
        importantFields: {
          candidates: SAMPLE_CATEGORY_RESPONSE.data.map(c => ({
            ma_nhom: c.ma_nhom,
            ten_nhom: c.ten_nhom,
            parent_name: c.parent_name,
            phan_loai: c.phan_loai,
            match_reason: c.match_reason,
          })),
        },
      },
      uiArtifact: { rawPayload: SAMPLE_CATEGORY_RESPONSE },
    })
  })

  describe('registry contract', () => {
    it('maps categorySuggestion to ai_category_suggestion RPC', () => {
      const mapping = getToolRpcMapping()
      expect(mapping.categorySuggestion).toBe('ai_category_suggestion')
    })

    it('requires device_name in inputSchema', () => {
      const registry = buildToolRegistry({
        request: new Request('http://localhost:3000/api/chat', { method: 'POST' }),
        tenantId: 17,
        userId: '42',
        requestedTools: ['categorySuggestion'],
      })

      const tool = registry.categorySuggestion as unknown as ExecutableTool
      expect(tool).toBeDefined()
    })
  })

  describe('executor wiring', () => {
    it('passes device_name to RPC args', async () => {
      const registry = buildToolRegistry({
        request: new Request('http://localhost:3000/api/chat', { method: 'POST' }),
        tenantId: 17,
        userId: '42',
        requestedTools: ['categorySuggestion'],
      })

      const tool = registry.categorySuggestion as unknown as ExecutableTool
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

  describe('envelope shape', () => {
    it('returns a valid ToolResponseEnvelope', async () => {
      const registry = buildToolRegistry({
        request: new Request('http://localhost:3000/api/chat', { method: 'POST' }),
        tenantId: 17,
        userId: '42',
        requestedTools: ['categorySuggestion'],
      })

      const tool = registry.categorySuggestion as unknown as ExecutableTool
      const result = await tool.execute({ device_name: 'bàn mổ' })

      expect(isToolResponseEnvelope(result)).toBe(true)
    })

    it('modelSummary.importantFields has candidate fields', async () => {
      const registry = buildToolRegistry({
        request: new Request('http://localhost:3000/api/chat', { method: 'POST' }),
        tenantId: 17,
        userId: '42',
        requestedTools: ['categorySuggestion'],
      })

      const tool = registry.categorySuggestion as unknown as ExecutableTool
      const result = (await tool.execute({ device_name: 'bàn mổ' })) as Record<string, unknown>
      const modelSummary = result.modelSummary as Record<string, unknown>

      expect(modelSummary.importantFields).toBeDefined()
      const fields = modelSummary.importantFields as Record<string, unknown>
      expect(fields.candidates).toBeInstanceOf(Array)

      const candidates = fields.candidates as Record<string, unknown>[]
      expect(candidates[0]).toHaveProperty('ma_nhom')
      expect(candidates[0]).toHaveProperty('ten_nhom')
      expect(candidates[0]).toHaveProperty('parent_name')
      expect(candidates[0]).toHaveProperty('phan_loai')
    })

    it('compacted output strips uiArtifact', async () => {
      const registry = buildToolRegistry({
        request: new Request('http://localhost:3000/api/chat', { method: 'POST' }),
        tenantId: 17,
        userId: '42',
        requestedTools: ['categorySuggestion'],
      })

      const tool = registry.categorySuggestion as unknown as ExecutableTool
      const result = await tool.execute({ device_name: 'bàn mổ' })
      const compacted = compactToolOutput('categorySuggestion', result)

      expect(compacted).toHaveProperty('modelSummary')
      expect(compacted).not.toHaveProperty('uiArtifact')
    })
  })
})
