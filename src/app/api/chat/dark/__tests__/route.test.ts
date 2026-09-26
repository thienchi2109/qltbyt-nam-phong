import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const getServerSessionMock = vi.fn()
const readGoBffConfigMock = vi.fn()
const buildGoBffRequestMock = vi.fn()
const proxyGoBffRequestMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock("@/lib/ai/go-bff/GoBffConfig", () => ({
  isGoBffConfigurationError: (error: unknown) =>
    error instanceof Error && error.name === "GoBffConfigurationError",
  readGoBffConfig: (...args: unknown[]) => readGoBffConfigMock(...args),
}))

vi.mock("@/lib/ai/go-bff/GoBffRequest", () => ({
  buildGoBffRequest: (...args: unknown[]) => buildGoBffRequestMock(...args),
  isAllowedDarkChatRole: (role: unknown) => role === "admin" || role === "user",
}))

vi.mock("@/lib/ai/go-bff/GoBffProxy", () => ({
  proxyGoBffRequest: (...args: unknown[]) => proxyGoBffRequestMock(...args),
}))

import { POST } from "../route"

const config = {
  endpoint: "https://ai.example.internal/v1/chat",
  hmacKeyId: "key-1",
  hmacSecret: "hmac-secret",
  brokerSecret: "broker-secret",
  cloudflareClientId: "access-id",
  cloudflareClientSecret: "access-secret",
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/chat/dark", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

describe("/api/chat/dark", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: "42", role: "admin", don_vi: 7 } })
    readGoBffConfigMock.mockReturnValue(config)
    buildGoBffRequestMock.mockResolvedValue({
      requestId: "req-dark-1",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: '{"protocol_version":"v1"}',
    })
    proxyGoBffRequestMock.mockResolvedValue(
      new Response('data: {"type":"start"}\n\n', {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
        },
      })
    )
  })

  it("rejects missing sessions before reading dark-path configuration", async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await POST(request({ messages: [] }, { "X-Request-ID": "req-unauth" }))

    expect(response.status).toBe(401)
    expect(response.headers.get("X-Request-ID")).toBe("req-unauth")
    expect(readGoBffConfigMock).not.toHaveBeenCalled()
    expect(proxyGoBffRequestMock).not.toHaveBeenCalled()
  })

  it("fails closed when the dark path has no server configuration", async () => {
    const error = new Error("missing config")
    error.name = "GoBffConfigurationError"
    readGoBffConfigMock.mockImplementation(() => {
      throw error
    })

    const response = await POST(
      request({ messages: [{ role: "user", parts: [{ type: "text", text: "Xin chào" }] }] })
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: {
        code: "capability_unavailable",
        message: "Đường kiểm thử trợ lý hiện chưa được cấu hình.",
      },
    })
    expect(buildGoBffRequestMock).not.toHaveBeenCalled()
  })

  it("validates then signs and proxies the dark request without changing /api/chat", async () => {
    const body = {
      messages: [{ role: "user", parts: [{ type: "text", text: "Tra cứu" }] }],
      requestedTools: ["equipmentLookup"],
      selectedFacilityId: 7,
    }
    const incoming = request(body, { "X-Request-ID": "req-dark-1" })

    const response = await POST(incoming)

    expect(response.status).toBe(200)
    expect(buildGoBffRequestMock).toHaveBeenCalledWith({
      config,
      requestId: "req-dark-1",
      user: { id: "42", role: "admin", don_vi: 7 },
      payload: body,
    })
    expect(proxyGoBffRequestMock).toHaveBeenCalledWith({
      request: incoming,
      config,
      requestId: "req-dark-1",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: '{"protocol_version":"v1"}',
    })
  })
})
