import * as React from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const getServerSessionMock = vi.fn()
const readGoBffConfigMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock("@/lib/ai/go-bff/GoBffConfig", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/go-bff/GoBffConfig")>(
    "@/lib/ai/go-bff/GoBffConfig"
  )
  return {
    ...actual,
    readGoBffConfig: (...args: unknown[]) => readGoBffConfigMock(...args),
  }
})

import { POST } from "@/app/api/chat/dark/route"

const config = {
  endpoint: "https://ai.example.internal/v1/chat",
  hmacKeyId: "key-1",
  hmacSecret: "hmac-secret",
  brokerSecret: "broker-secret",
  cloudflareClientId: "access-id",
  cloudflareClientSecret: "access-secret",
}

function DarkChatHarness() {
  const { sendMessage, stop, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat/dark",
      fetch: async (input, init) => {
        const request = new Request(new URL(String(input), "http://localhost"), init)
        return POST(request)
      },
    }),
  })

  return (
    <div>
      <button
        type="button"
        onClick={() => sendMessage({ text: "Xin chào" })}
        disabled={status === "submitted" || status === "streaming"}
      >
        Gửi
      </button>
      <button type="button" onClick={() => stop()} disabled={status !== "streaming"}>
        Dừng
      </button>
      <span data-testid="chat-status">{status}</span>
    </div>
  )
}

describe("dark BFF transport abort contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: "42", role: "user", don_vi: 7 } })
    readGoBffConfigMock.mockReturnValue(config)
  })

  it("carries a user stop through useChat, /api/chat/dark, BFF proxy and upstream fetch", async () => {
    let upstreamStarted!: () => void
    const started = new Promise<void>((resolve) => {
      upstreamStarted = resolve
    })
    let upstreamAborted!: () => void
    const aborted = new Promise<void>((resolve) => {
      upstreamAborted = resolve
    })
    const upstreamFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      upstreamStarted()
      const encoder = new TextEncoder()
      let closeBody!: () => void
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          closeBody = () => controller.close()
          const encode = (chunk: unknown) => encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
          controller.enqueue(encode({ type: "start", messageId: "message-1" }))
          controller.enqueue(encode({ type: "start-step" }))
          controller.enqueue(encode({ type: "text-start", id: "text-1" }))
          controller.enqueue(encode({ type: "text-delta", id: "text-1", delta: "Xin" }))
        },
      })
      const signal = init?.signal
      if (!signal) {
        throw new Error("missing upstream abort signal")
      }
      signal.addEventListener(
        "abort",
        () => {
          upstreamAborted()
          closeBody()
        },
        { once: true }
      )
      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-vercel-ai-ui-message-stream": "v1",
            "x-request-id": "req-dark-transport",
          },
        })
      )
    })
    vi.stubGlobal("fetch", upstreamFetch)

    render(<DarkChatHarness />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Gửi" }))
    await started

    await waitFor(() => expect(getServerSessionMock).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByTestId("chat-status")).toHaveTextContent("streaming"))
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Dừng" }))
      await aborted
    })

    expect(upstreamFetch).toHaveBeenCalledWith(
      config.endpoint,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect((upstreamFetch.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(true)
    expect(readGoBffConfigMock).toHaveBeenCalledOnce()
  })
})
