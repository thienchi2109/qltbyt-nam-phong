import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const executeRpcToolMock = vi.fn()

vi.mock('@/lib/ai/tools/rpc-tool-executor', () => ({
  executeRpcTool: (...args: unknown[]) => executeRpcToolMock(...args),
}))

import { buildToolRegistry } from '../registry'

type ExecutableTool = {
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

describe('equipmentLookup identifier preservation', () => {
  beforeEach(() => {
    executeRpcToolMock.mockReset()
    executeRpcToolMock.mockResolvedValue({ data: [], total: 0 })
  })

  it('reuses the full device code from the latest user message when model truncates query', async () => {
    const registry = buildToolRegistry({
      request: new Request('http://localhost:3000/api/chat', { method: 'POST' }),
      tenantId: 17,
      userId: '31',
      requestedTools: ['equipmentLookup'],
      equipmentLookupHints: {
        verbatimIdentifiers: ['TT.1.92004.JPDCTA1000147'],
      },
    })

    const lookupTool = registry.equipmentLookup as unknown as ExecutableTool
    await lookupTool.execute({ query: 'TT.1.92004.JPDCTA100014' })

    expect(executeRpcToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rpcFunction: 'ai_equipment_lookup',
        args: expect.objectContaining({
          query: 'TT.1.92004.JPDCTA1000147',
          filters: expect.objectContaining({
            equipmentCode: 'TT.1.92004.JPDCTA1000147',
          }),
          p_don_vi: 17,
          p_user_id: '31',
        }),
      }),
    )
  })

  it('preserves an explicitly provided exact equipmentCode filter', async () => {
    const registry = buildToolRegistry({
      request: new Request('http://localhost:3000/api/chat', { method: 'POST' }),
      tenantId: 17,
      userId: '31',
      requestedTools: ['equipmentLookup'],
      equipmentLookupHints: {
        verbatimIdentifiers: ['TT.1.92004.JPDCTA1000147'],
      },
    })

    const lookupTool = registry.equipmentLookup as unknown as ExecutableTool
    await lookupTool.execute({
      query: 'Máy phun khí dung',
      filters: { equipmentCode: 'TT.1.92004.JPDCTA1000147' },
    })

    expect(executeRpcToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          query: 'Máy phun khí dung',
          filters: expect.objectContaining({
            equipmentCode: 'TT.1.92004.JPDCTA1000147',
          }),
        }),
      }),
    )
  })

  it('does not coerce identifier-shaped queries into equipmentCode when the query does not match the user code hint', async () => {
    const registry = buildToolRegistry({
      request: new Request('http://localhost:3000/api/chat', { method: 'POST' }),
      tenantId: 17,
      userId: '31',
      requestedTools: ['equipmentLookup'],
      equipmentLookupHints: {
        verbatimIdentifiers: ['TT.1.92004.JPDCTA1000147'],
      },
    })

    const lookupTool = registry.equipmentLookup as unknown as ExecutableTool
    await lookupTool.execute({ query: 'SN-ABC-1234' })

    expect(executeRpcToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          query: 'SN-ABC-1234',
          p_don_vi: 17,
          p_user_id: '31',
        }),
      }),
    )

    const call = executeRpcToolMock.mock.calls[0]?.[0] as {
      args?: Record<string, unknown>
    }
    expect(call.args?.filters).toBeUndefined()
  })
})
