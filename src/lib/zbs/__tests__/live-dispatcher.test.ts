import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ZBS_CLAIM_DISPATCH_RPC,
  ZBS_MARK_FAILED_RPC,
  ZBS_MARK_SENT_RPC,
  dispatchPendingZbsNotifications,
} from "../live-dispatcher"

const baseOutboxRow = {
  id: "outbox-1",
  event_type: "repair_request_created",
  source_type: "repair_request",
  source_id: 42,
  don_vi_id: 17,
  recipient_config_id: "recipient-1",
  recipient_phone: "0987654321",
  template_id: null,
  tracking_id: "repair_request:42:recipient-1",
  status: "pending",
  provider: "zalo_zbs",
  last_attempt_at: "2026-06-30T08:00:00.000Z",
  next_attempt_at: "2026-06-30T00:00:00.000Z",
  template_data: {
    repair_request_id: 42,
    equipment_code: "TB-001",
    equipment_name: "May tho ICU",
    department: "ICU",
    issue_description: "Khong khoi dong duoc",
    requester: "Nguyen Van A",
  },
} as const

describe("dispatchPendingZbsNotifications", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not claim rows or call Zalo when the dispatch gate is disabled", async () => {
    const rpcClient = vi.fn()
    const fetchImpl = vi.fn()

    const result = await dispatchPendingZbsNotifications({
      dispatchEnabled: false,
      rpcClient,
      fetchImpl,
      now: new Date("2026-06-30T08:00:00.000Z"),
    })

    expect(result).toEqual({
      dispatch_state: "disabled-dispatch",
      attempted: 0,
      sent: 0,
      retryable_failed: 0,
      failed: 0,
      results: [],
    })
    expect(rpcClient).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("claims targeted pending rows and marks successful sends with sanitized provider metadata", async () => {
    const rpcClient = vi
      .fn()
      .mockResolvedValueOnce([baseOutboxRow])
      .mockResolvedValueOnce([{ id: "outbox-1", status: "sent" }])
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 0,
          message: "Success",
          data: {
            msg_id: "zalo-message-1",
            sent_time: "2026-06-30T08:00:01.000Z",
            quota: { daily_remaining: 42 },
          },
        }),
        { status: 200 }
      )
    )

    const result = await dispatchPendingZbsNotifications({
      dispatchEnabled: true,
      accessToken: "zalo-access-token",
      repairTemplateId: "template-123",
      outboxIds: ["outbox-1"],
      rpcClient,
      fetchImpl,
      now: new Date("2026-06-30T08:00:00.000Z"),
    })

    expect(rpcClient).toHaveBeenNthCalledWith(1, {
      fn: ZBS_CLAIM_DISPATCH_RPC,
      args: {
        p_limit: 25,
        p_now: "2026-06-30T08:00:00.000Z",
        p_outbox_ids: ["outbox-1"],
      },
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://business.openapi.zalo.me/message/template",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: "zalo-access-token",
        },
      })
    )
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      phone: "84987654321",
      template_id: "template-123",
      tracking_id: "repair_request:42:recipient-1",
      template_data: {
        request_id: "42",
        issue_summary: "Khong khoi dong duoc",
      },
    })
    expect(rpcClient).toHaveBeenNthCalledWith(2, {
      fn: ZBS_MARK_SENT_RPC,
      args: {
        p_id: "outbox-1",
        p_claimed_at: "2026-06-30T08:00:00.000Z",
        p_provider_message_id: "zalo-message-1",
        p_sent_at: "2026-06-30T08:00:01.000Z",
        p_provider_response: {
          error: 0,
          message: "Success",
          data: {
            msg_id: "zalo-message-1",
            sent_time: "2026-06-30T08:00:01.000Z",
            quota: { daily_remaining: 42 },
          },
        },
      },
    })
    expect(result).toMatchObject({
      dispatch_state: "live-dispatch",
      attempted: 1,
      sent: 1,
      retryable_failed: 0,
      failed: 0,
      results: [{ outbox_id: "outbox-1", status: "sent", provider_message_id: "zalo-message-1" }],
    })
  })

  it("preserves an explicit empty outbox filter when claiming rows", async () => {
    const rpcClient = vi.fn().mockResolvedValueOnce([])
    const fetchImpl = vi.fn()

    const result = await dispatchPendingZbsNotifications({
      dispatchEnabled: true,
      accessToken: "zalo-access-token",
      repairTemplateId: "template-123",
      outboxIds: [],
      rpcClient,
      fetchImpl,
      now: new Date("2026-06-30T08:00:00.000Z"),
    })

    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_CLAIM_DISPATCH_RPC,
      args: {
        p_limit: 25,
        p_now: "2026-06-30T08:00:00.000Z",
        p_outbox_ids: [],
      },
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      attempted: 0,
      results: [],
    })
  })

  it("persists retryable and final failures per outbox row without aborting the batch", async () => {
    const retryableRow = { ...baseOutboxRow, id: "retryable-row", tracking_id: "retryable" }
    const successRow = { ...baseOutboxRow, id: "success-row", tracking_id: "success" }
    const finalFailureRow = { ...baseOutboxRow, id: "final-row", tracking_id: "final" }
    const rpcClient = vi
      .fn()
      .mockResolvedValueOnce([retryableRow, successRow, finalFailureRow])
      .mockResolvedValue([{ id: "updated" }])
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporarily unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 0, data: { msg_id: "zalo-message-2" } }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: -1121,
            message: "issue_summary data breaks max length",
          }),
          { status: 200 }
        )
      )

    const result = await dispatchPendingZbsNotifications({
      dispatchEnabled: true,
      accessToken: "zalo-access-token",
      repairTemplateId: "template-123",
      rpcClient,
      fetchImpl,
      now: new Date("2026-06-30T08:00:00.000Z"),
    })

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_MARK_FAILED_RPC,
      args: expect.objectContaining({
        p_id: "retryable-row",
        p_retryable: true,
        p_error_code: "http_503",
      }),
    })
    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_MARK_SENT_RPC,
      args: expect.objectContaining({
        p_id: "success-row",
        p_provider_message_id: "zalo-message-2",
      }),
    })
    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_MARK_FAILED_RPC,
      args: expect.objectContaining({
        p_id: "final-row",
        p_retryable: false,
        p_error_code: "zalo_-1121",
      }),
    })
    expect(result).toMatchObject({
      attempted: 3,
      sent: 1,
      retryable_failed: 1,
      failed: 1,
      results: [
        { outbox_id: "retryable-row", status: "retryable_failed" },
        { outbox_id: "success-row", status: "sent" },
        { outbox_id: "final-row", status: "failed" },
      ],
    })
  })

  it("marks malformed successful provider responses as non-retryable provider failures", async () => {
    const rpcClient = vi.fn().mockResolvedValueOnce([baseOutboxRow]).mockResolvedValueOnce(null)
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 0,
          message: "Success",
          data: { accepted: true },
        }),
        { status: 200 }
      )
    )

    const result = await dispatchPendingZbsNotifications({
      dispatchEnabled: true,
      accessToken: "zalo-access-token",
      repairTemplateId: "template-123",
      rpcClient,
      fetchImpl,
      now: new Date("2026-06-30T08:00:00.000Z"),
    })

    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_MARK_FAILED_RPC,
      args: {
        p_id: "outbox-1",
        p_claimed_at: "2026-06-30T08:00:00.000Z",
        p_retryable: false,
        p_error_code: "invalid_provider_response",
        p_error_message: "Missing Zalo provider msg_id",
        p_provider_response: {
          error: 0,
          message: "Success",
          data: { accepted: true },
        },
      },
    })
    expect(result).toMatchObject({
      attempted: 1,
      sent: 0,
      retryable_failed: 0,
      failed: 1,
      results: [
        {
          outbox_id: "outbox-1",
          status: "failed",
          error_code: "invalid_provider_response",
        },
      ],
    })
  })

  it("marks request-build errors failed without aborting the batch", async () => {
    const invalidRow = { ...baseOutboxRow, id: "invalid-row", recipient_phone: "not-a-phone" }
    const successRow = { ...baseOutboxRow, id: "success-row", tracking_id: "success" }
    const rpcClient = vi
      .fn()
      .mockResolvedValueOnce([invalidRow, successRow])
      .mockResolvedValue([{ id: "updated" }])
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 0, data: { msg_id: "zalo-message-2" } }), {
        status: 200,
      })
    )

    const result = await dispatchPendingZbsNotifications({
      dispatchEnabled: true,
      accessToken: "zalo-access-token",
      repairTemplateId: "template-123",
      rpcClient,
      fetchImpl,
      now: new Date("2026-06-30T08:00:00.000Z"),
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_MARK_FAILED_RPC,
      args: {
        p_id: "invalid-row",
        p_claimed_at: "2026-06-30T08:00:00.000Z",
        p_retryable: false,
        p_error_code: "invalid_template_request",
        p_error_message: "Invalid ZBS recipient phone",
        p_provider_response: {},
      },
    })
    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_MARK_SENT_RPC,
      args: expect.objectContaining({
        p_id: "success-row",
        p_provider_message_id: "zalo-message-2",
      }),
    })
    expect(result).toMatchObject({
      attempted: 2,
      sent: 1,
      retryable_failed: 0,
      failed: 1,
      results: [
        {
          outbox_id: "invalid-row",
          status: "failed",
          error_code: "invalid_template_request",
        },
        { outbox_id: "success-row", status: "sent" },
      ],
    })
  })

  it("aborts hung provider requests and records a retryable network failure", async () => {
    vi.useFakeTimers()
    const rpcClient = vi.fn().mockResolvedValueOnce([baseOutboxRow]).mockResolvedValueOnce(null)
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("provider request aborted"))
        })
      })
    })

    const resultPromise = dispatchPendingZbsNotifications({
      dispatchEnabled: true,
      accessToken: "zalo-access-token",
      repairTemplateId: "template-123",
      rpcClient,
      fetchImpl,
      now: new Date("2026-06-30T08:00:00.000Z"),
    })

    await vi.advanceTimersByTimeAsync(15_000)
    const result = await resultPromise

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://business.openapi.zalo.me/message/template",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    )
    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_MARK_FAILED_RPC,
      args: expect.objectContaining({
        p_id: "outbox-1",
        p_retryable: true,
        p_error_code: "network_error",
        p_error_message: "provider request aborted",
      }),
    })
    expect(result).toMatchObject({
      attempted: 1,
      retryable_failed: 1,
      failed: 0,
    })
  })

  it("starts independent provider sends in the same chunk without waiting for earlier sends", async () => {
    const firstRow = { ...baseOutboxRow, id: "outbox-1", tracking_id: "first" }
    const secondRow = { ...baseOutboxRow, id: "outbox-2", tracking_id: "second" }
    const rpcClient = vi
      .fn()
      .mockResolvedValueOnce([firstRow, secondRow])
      .mockResolvedValue([{ id: "updated" }])
    let resolveFirstSend: (response: Response) => void = () => undefined
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirstSend = resolve
          })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 0, data: { msg_id: "zalo-message-2" } }), {
          status: 200,
        })
      )

    const resultPromise = dispatchPendingZbsNotifications({
      dispatchEnabled: true,
      accessToken: "zalo-access-token",
      repairTemplateId: "template-123",
      rpcClient,
      fetchImpl,
      now: new Date("2026-06-30T08:00:00.000Z"),
    })

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled())
    await Promise.resolve()
    const callsBeforeFirstSendFinished = fetchImpl.mock.calls.length
    resolveFirstSend(
      new Response(JSON.stringify({ error: 0, data: { msg_id: "zalo-message-1" } }), {
        status: 200,
      })
    )
    const result = await resultPromise

    expect(callsBeforeFirstSendFinished).toBe(2)
    expect(result).toMatchObject({
      attempted: 2,
      sent: 2,
      results: [
        { outbox_id: "outbox-1", status: "sent" },
        { outbox_id: "outbox-2", status: "sent" },
      ],
    })
  })

  it("isolates unexpected row-level failures without aborting the remaining chunk", async () => {
    const rejectedRow = { ...baseOutboxRow, id: "rejected-row", tracking_id: "rejected" }
    const successRow = { ...baseOutboxRow, id: "success-row", tracking_id: "success" }
    const rpcClient = vi.fn().mockImplementation(async ({ fn, args }) => {
      if (fn === ZBS_CLAIM_DISPATCH_RPC) {
        return [rejectedRow, successRow]
      }
      if (args.p_id === "rejected-row") {
        throw new Error("provider token should not leak")
      }
      return [{ id: "updated" }]
    })
    const fetchImpl = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 0, data: { msg_id: "zalo-message" } }), {
          status: 200,
        })
      )
    )

    const result = await dispatchPendingZbsNotifications({
      dispatchEnabled: true,
      accessToken: "zalo-access-token",
      repairTemplateId: "template-123",
      rpcClient,
      fetchImpl,
      now: new Date("2026-06-30T08:00:00.000Z"),
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({
      attempted: 2,
      sent: 1,
      failed: 1,
      results: [
        {
          outbox_id: "rejected-row",
          status: "failed",
          error_code: "dispatch_row_error",
          error_message: "Unexpected ZBS dispatch row failure",
        },
        { outbox_id: "success-row", status: "sent" },
      ],
    })
  })
})
