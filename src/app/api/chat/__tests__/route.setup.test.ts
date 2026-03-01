import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

import { POST } from '../route'

describe('/api/chat setup', () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    getServerSessionMock.mockResolvedValue(null)
  })

  it('returns 401 when session missing', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })
})
