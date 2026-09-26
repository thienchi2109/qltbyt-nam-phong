import * as React from "react"
import { readFileSync } from "node:fs"
import { join } from "node:path"
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
import { AssistantMessageList } from "../AssistantMessageList"

const config = {
  endpoint: "https://ai.example.internal/v1/chat",
  hmacKeyId: "key-1",
  hmacSecret: "hmac-secret",
  brokerSecret: "broker-secret",
  cloudflareClientId: "access-id",
  cloudflareClientSecret: "access-secret",
}

function DarkChatHarness() {
  const { messages, sendMessage, stop, status } = useChat({
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
      <AssistantMessageList messages={messages} status={status} onApplyDraft={() => {}} />
    </div>
  )
}

type MarkdownTableFixture = {
  chunks: string[]
  expected: {
    columns: string[]
    rows: string[][]
  }
}

function readMarkdownTableFixture(): MarkdownTableFixture {
  const fixture = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "openspec/changes/refactor-ai-into-shared-go-service/phase-5/fixtures/ui-contract.json"
      ),
      "utf8"
    )
  ) as {
    cases: Array<{ id: string; payload: unknown }>
  }
  const tableCase = fixture.cases.find((item) => item.id === "markdown-table")
  if (!tableCase || !tableCase.payload || typeof tableCase.payload !== "object") {
    throw new Error("markdown-table fixture is missing")
  }
  return tableCase.payload as MarkdownTableFixture
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

  it("renders a complete safe table when dark stream deltas split headers, delimiters and cells", async () => {
    const table = readMarkdownTableFixture()
    const upstreamFetch = vi.fn(() => {
      const encoder = new TextEncoder()
      const encode = (chunk: unknown) => encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encode({ type: "start", messageId: "message-table" }))
          controller.enqueue(encode({ type: "start-step" }))
          controller.enqueue(encode({ type: "text-start", id: "text-table" }))
          for (const delta of table.chunks) {
            controller.enqueue(encode({ type: "text-delta", id: "text-table", delta }))
          }
          controller.enqueue(encode({ type: "text-end", id: "text-table" }))
          controller.enqueue(encode({ type: "finish-step" }))
          controller.enqueue(encode({ type: "finish", finishReason: "stop" }))
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        },
      })
      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-vercel-ai-ui-message-stream": "v1",
            "x-request-id": "req-table-stream",
          },
        })
      )
    })
    vi.stubGlobal("fetch", upstreamFetch)

    render(<DarkChatHarness />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Gửi" }))

    const tableElement = await screen.findByRole("table")
    await waitFor(() => expect(screen.getByTestId("chat-status")).toHaveTextContent("ready"))

    expect(tableElement.querySelectorAll("thead th")).toHaveLength(table.expected.columns.length)
    expect(tableElement.querySelectorAll("tbody tr")).toHaveLength(table.expected.rows.length)
    expect(
      Array.from(tableElement.querySelectorAll("tbody tr")).every(
        (row) => row.querySelectorAll("td").length === table.expected.columns.length,
      ),
    ).toBe(true)
    expect(tableElement).toHaveTextContent("Thiết bị")
    expect(tableElement).toHaveTextContent("Máy siêu âm")
    expect(tableElement).toHaveTextContent("Chưa có dữ liệu")
    expect(tableElement).toHaveTextContent("Máy X|Y")
    expect(tableElement.querySelector("img")).not.toBeInTheDocument()
    expect(tableElement.querySelector("[onerror]")).not.toBeInTheDocument()

    const scrollContainer = tableElement.closest("div.overflow-x-auto")
    expect(scrollContainer).toHaveClass("min-w-0")
    expect(scrollContainer).toHaveClass("overflow-x-auto")
    expect(upstreamFetch).toHaveBeenCalledWith(
      config.endpoint,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })
})
