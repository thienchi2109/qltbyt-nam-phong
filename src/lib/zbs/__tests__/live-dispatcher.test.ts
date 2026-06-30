import { describe, expect, it, vi } from "vitest"

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
})
