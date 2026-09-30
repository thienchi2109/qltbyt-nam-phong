import { readFileSync } from "node:fs"
import { join } from "node:path"

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
  readGoBffConfig: (...args: unknown[]) => readGoBffConfigMock(...args),
}))

vi.mock("@/lib/ai/go-bff/GoBffRequest", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/go-bff/GoBffRequest")>(
    "@/lib/ai/go-bff/GoBffRequest"
  )
  return {
    ...actual,
    buildGoBffRequest: (...args: unknown[]) => buildGoBffRequestMock(...args),
  }
})

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
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

describe("/api/chat Go cutover", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: "42", role: "admin", don_vi: 7 } })
    readGoBffConfigMock.mockReturnValue(config)
    buildGoBffRequestMock.mockResolvedValue({
      requestId: "req-cutover-1",
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

  it("rejects a missing session before reading Go BFF configuration", async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await POST(request({ messages: [] }, { "X-Request-ID": "req-unauth" }))

    expect(response.status).toBe(401)
    expect(readGoBffConfigMock).not.toHaveBeenCalled()
    expect(proxyGoBffRequestMock).not.toHaveBeenCalled()
  })

  it("rejects chuyen_gia before signing a request", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "42", role: "chuyen_gia", don_vi: 7 } })

    const response = await POST(request({ messages: [] }))

    expect(response.status).toBe(403)
    expect(buildGoBffRequestMock).not.toHaveBeenCalled()
    expect(proxyGoBffRequestMock).not.toHaveBeenCalled()
  })

  it("fails closed when the Go BFF is not configured", async () => {
    readGoBffConfigMock.mockImplementation(() => {
      throw new Error("missing config")
    })

    const response = await POST(
      request({ messages: [{ role: "user", parts: [{ type: "text", text: "Xin chào" }] }] })
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: {
        code: "capability_unavailable",
        message: "Tính năng trợ lý hiện không khả dụng.",
      },
    })
    expect(buildGoBffRequestMock).not.toHaveBeenCalled()
    expect(proxyGoBffRequestMock).not.toHaveBeenCalled()
  })

  it("signs and proxies the production request through the Go BFF", async () => {
    const body = {
      messages: [{ role: "user", parts: [{ type: "text", text: "Tra cứu" }] }],
      requestedTools: ["equipmentLookup"],
      selectedFacilityId: 7,
    }
    const incoming = request(body, { "X-Request-ID": "req-cutover-1" })

    const response = await POST(incoming)

    expect(response.status).toBe(200)
    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1")
    expect(buildGoBffRequestMock).toHaveBeenCalledWith({
      config,
      requestId: "req-cutover-1",
      user: { id: "42", role: "admin", don_vi: 7 },
      payload: body,
    })
    expect(proxyGoBffRequestMock).toHaveBeenCalledWith({
      request: incoming,
      config,
      requestId: "req-cutover-1",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: '{"protocol_version":"v1"}',
    })
  })

  it("keeps the live route on the Go BFF and off the parked orchestrator", () => {
    const root = process.cwd()
    const routeSource = readFileSync(join(root, "src/app/api/chat/route.ts"), "utf8")
    const legacySource = readFileSync(
      join(root, "src/app/api/chat/legacy-next-orchestrator.ts"),
      "utf8"
    )

    expect(routeSource).toContain("postGoBffChat")
    expect(routeSource).toContain("go-bff")
    expect(routeSource).not.toContain("streamText")
    expect(routeSource).not.toContain("reserveUsage")
    expect(routeSource).not.toContain("legacy-next-orchestrator")
    expect(legacySource).toContain("streamText")
    expect(legacySource).toContain("reserveUsage")
  })
})
