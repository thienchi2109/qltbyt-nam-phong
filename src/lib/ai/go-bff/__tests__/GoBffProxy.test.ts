import { describe, expect, it, vi } from "vitest"

import { proxyGoBffRequest } from "../GoBffProxy"

const config = {
  endpoint: "https://ai.example.internal/v1/chat",
  hmacKeyId: "key-1",
  hmacSecret: "hmac-secret",
  brokerSecret: "broker-secret",
  cloudflareClientId: "access-id",
  cloudflareClientSecret: "access-secret",
}

describe("proxyGoBffRequest", () => {
  it("logs only redacted metadata for an upstream failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("secret-body", {
          status: 403,
          headers: { "content-type": "text/html", "cf-ray": "ray-1" },
        })
      )
    )
    await proxyGoBffRequest({
      request: new Request("http://localhost/api/chat/dark", { method: "POST" }),
      config,
      requestId: "req-log",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: '{"secret":"request-body"}',
    })
    expect(warn).toHaveBeenCalledWith("[ai-bff] upstream failure", {
      requestId: "req-log",
      status: 403,
      contentType: "text/html",
      cfRay: "ray-1",
      class: "access_html",
    })
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-body")
    expect(JSON.stringify(warn.mock.calls)).not.toContain("request-body")
    warn.mockRestore()
  })
  it("forwards the signed stream and abort signal without forwarding cookies", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"type":"start"}'))
        controller.close()
      },
    })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
          "x-request-id": "req-dark-1",
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    const controller = new AbortController()
    const request = new Request("http://localhost/api/chat/dark", {
      method: "POST",
      signal: controller.signal,
    })

    const response = await proxyGoBffRequest({
      request,
      config,
      requestId: "req-dark-1",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: '{"ok":true}',
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1")
    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(endpoint).toBe(config.endpoint)
    expect(init.body).toBe('{"ok":true}')
    expect(init.signal).toBe(request.signal)
    const headers = init.headers as Headers
    expect(headers.get("CF-Access-Client-Id")).toBe("access-id")
    expect(headers.get("CF-Access-Client-Secret")).toBe("access-secret")
    expect(headers.get("X-AI-Service-Key-ID")).toBe("key-1")
    expect(headers.get("X-AI-Service-Signature")).toBe("signature")
    expect(headers.get("Cookie")).toBeNull()
  })

  it("maps an app quota response even when the upstream body omits status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "limit_exceeded", retry_after_ms: 1_500 }), {
          status: 429,
        })
      )
    )

    const response = await proxyGoBffRequest({
      request: new Request("http://localhost/api/chat/dark", { method: "POST" }),
      config,
      requestId: "req-quota-status",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: "{}",
    })

    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({
      error: { code: "ai_usage_limited", retryAfterMs: 1500 },
    })
  })

  it("fails closed when an otherwise successful upstream response is not a UI stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    )

    const response = await proxyGoBffRequest({
      request: new Request("http://localhost/api/chat/dark", { method: "POST" }),
      config,
      requestId: "req-invalid-stream",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: "{}",
    })

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: {
        code: "provider_failure",
        message: "Bộ mô hình không hoàn tất được yêu cầu. Vui lòng thử lại sau.",
      },
    })
  })

  it("treats an AbortError-shaped failure as browser cancellation", async () => {
    const abortError = new Error("request aborted")
    abortError.name = "AbortError"
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError))

    const response = await proxyGoBffRequest({
      request: new Request("http://localhost/api/chat/dark", { method: "POST" }),
      config,
      requestId: "req-abort",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: "{}",
    })

    expect(response.status).toBe(499)
    expect(await response.json()).toEqual({
      error: { code: "cancelled", message: "Yêu cầu đã được hủy." },
    })
  })

  it("maps app quota to the existing client contract while preserving provider_quota", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 429,
            code: "limit_exceeded",
            message: "AI usage quota exceeded.",
            retryable: true,
            retry_after_ms: 45000,
            request_id: "req-quota",
          }),
          { status: 429, headers: { "X-Request-ID": "req-quota" } }
        )
      )
    )
    const quota = await proxyGoBffRequest({
      request: new Request("http://localhost/api/chat/dark", { method: "POST" }),
      config,
      requestId: "req-quota",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: "{}",
    })
    expect(quota.status).toBe(429)
    expect(quota.headers.get("Retry-After")).toBe("45")
    expect(await quota.json()).toEqual({
      error: {
        code: "ai_usage_limited",
        reason: "quota",
        message: "Anh/chị đã dùng hết lượt trợ lý trong kỳ này.",
        retryAfterMs: 45000,
      },
    })

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 503, code: "provider_quota", retryable: true }), {
          status: 503,
        })
      )
    )
    const providerQuota = await proxyGoBffRequest({
      request: new Request("http://localhost/api/chat/dark", { method: "POST" }),
      config,
      requestId: "req-provider-quota",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: "{}",
    })
    expect((await providerQuota.json()).error.code).toBe("provider_quota")
  })

  it("returns a sanitized Vietnamese error for malformed upstream payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("secret SELECT * FROM users", { status: 502 }))
    )
    const response = await proxyGoBffRequest({
      request: new Request("http://localhost/api/chat/dark", { method: "POST" }),
      config,
      requestId: "req-safe-error",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: "{}",
    })
    const text = await response.text()
    expect(text).not.toContain("SELECT")
    expect(text).toContain("Bộ mô hình")
  })

  it("distinguishes an HTML Access denial from a Go protocol unauthorized response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Access denied</html>", {
          status: 403,
          headers: { "content-type": "text/html" },
        })
      )
    )

    const response = await proxyGoBffRequest({
      request: new Request("http://localhost/api/chat/dark", { method: "POST" }),
      config,
      requestId: "req-access-denied",
      timestamp: "1700000000",
      signature: "signature",
      rawBody: "{}",
    })

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({
      error: {
        code: "access_denied",
        message: "Đường kết nối bảo mật tới trợ lý bị từ chối.",
      },
    })
  })
})
