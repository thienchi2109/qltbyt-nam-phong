import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchTenantList } from '../add-equipment-dialog.queries'

const mockCallRpc = vi.fn()

vi.mock('@/lib/rpc-client', () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

describe('add-equipment-dialog.queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes tenant_list payloads and skips malformed rows', async () => {
    mockCallRpc.mockResolvedValue([
      { id: 1, code: 'HA', name: 'Hospital A', active: true },
      { id: '2', code: null, name: 'Hospital B' },
      { id: 3, code: 'HC', name: '' },
      null,
      { foo: 'bar' },
    ])

    await expect(fetchTenantList()).resolves.toEqual([
      { id: 1, code: 'HA', name: 'Hospital A' },
      { id: 2, code: null, name: 'Hospital B' },
    ])
  })
})
