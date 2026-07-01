import { describe, expect, it, vi } from "vitest"

import {
  ZBS_CLAIM_DISPATCH_RPC,
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

describe("dispatchPendingZbsNotifications success persistence", () => {
  it("normalizes epoch-millisecond provider sent_time before marking successful sends", async () => {
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
            sent_time: "1719734401000",
          },
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

    expect(rpcClient).toHaveBeenNthCalledWith(2, {
      fn: ZBS_MARK_SENT_RPC,
      args: expect.objectContaining({
        p_id: "outbox-1",
        p_claimed_at: "2026-06-30T08:00:00.000Z",
        p_provider_message_id: "zalo-message-1",
        p_sent_at: "2024-06-30T08:00:01.000Z",
      }),
    })
    expect(result).toMatchObject({
      attempted: 1,
      sent: 1,
      failed: 0,
      results: [{ outbox_id: "outbox-1", status: "sent", provider_message_id: "zalo-message-1" }],
    })
  })

  it("surfaces safe mark-sent RPC failures without aborting the remaining chunk", async () => {
    const rejectedRow = { ...baseOutboxRow, id: "rejected-row", tracking_id: "rejected" }
    const successRow = { ...baseOutboxRow, id: "success-row", tracking_id: "success" }
    const rpcClient = vi.fn().mockImplementation(async ({ fn, args }) => {
      if (fn === ZBS_CLAIM_DISPATCH_RPC) {
        return [rejectedRow, successRow]
      }
      if (args.p_id === "rejected-row") {
        throw new Error("ZBS outbox row rejected-row is not claimable as sent for this lease")
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
          error_message: "ZBS outbox row rejected-row is not claimable as sent for this lease",
        },
        { outbox_id: "success-row", status: "sent" },
      ],
    })
  })
})
