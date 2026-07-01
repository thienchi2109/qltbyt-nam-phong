import { describe, expect, it, vi } from "vitest"

import { ZbsAccessTokenRefreshError } from "../access-token-manager"
import { ZBS_MARK_FAILED_RPC, dispatchPendingZbsNotifications } from "../live-dispatcher"

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

describe("dispatchPendingZbsNotifications token lifecycle", () => {
  it("loads a managed access token before sending claimed rows", async () => {
    const rpcClient = vi
      .fn()
      .mockResolvedValueOnce([baseOutboxRow])
      .mockResolvedValueOnce([{ id: "outbox-1", status: "sent" }])
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 0, data: { msg_id: "zalo-message-1" } }), {
        status: 200,
      })
    )
    const accessTokenProvider = vi.fn().mockResolvedValue("managed-access-token")

    const result = await dispatchPendingZbsNotifications({
      dispatchEnabled: true,
      accessTokenProvider,
      repairTemplateId: "template-123",
      rpcClient,
      fetchImpl,
      now: new Date("2026-06-30T08:00:00.000Z"),
    })

    expect(accessTokenProvider).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://business.openapi.zalo.me/message/template",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          access_token: "managed-access-token",
        },
      })
    )
    expect(result).toMatchObject({
      attempted: 1,
      sent: 1,
      failed: 0,
    })
  })

  it("marks claimed rows failed when the managed access token refresh fails", async () => {
    const firstRow = { ...baseOutboxRow, id: "outbox-1", tracking_id: "first" }
    const secondRow = { ...baseOutboxRow, id: "outbox-2", tracking_id: "second" }
    const rpcClient = vi.fn().mockResolvedValue([{ id: "updated" }])
    rpcClient.mockResolvedValueOnce([firstRow, secondRow])
    const fetchImpl = vi.fn()
    const accessTokenProvider = vi.fn().mockRejectedValue(
      new ZbsAccessTokenRefreshError({
        code: "zalo_token_refresh_failed",
        safeMessage: "Zalo access token refresh failed",
        retryable: false,
      })
    )

    const result = await dispatchPendingZbsNotifications({
      dispatchEnabled: true,
      accessTokenProvider,
      repairTemplateId: "template-123",
      rpcClient,
      fetchImpl,
      now: new Date("2026-06-30T08:00:00.000Z"),
    })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_MARK_FAILED_RPC,
      args: expect.objectContaining({
        p_id: "outbox-1",
        p_retryable: false,
        p_error_code: "zalo_token_refresh_failed",
        p_error_message: "Zalo access token refresh failed",
        p_provider_response: {},
      }),
    })
    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_MARK_FAILED_RPC,
      args: expect.objectContaining({
        p_id: "outbox-2",
        p_retryable: false,
        p_error_code: "zalo_token_refresh_failed",
        p_error_message: "Zalo access token refresh failed",
        p_provider_response: {},
      }),
    })
    expect(result).toEqual({
      dispatch_state: "live-dispatch",
      attempted: 2,
      sent: 0,
      retryable_failed: 0,
      failed: 2,
      results: [
        {
          outbox_id: "outbox-1",
          status: "failed",
          error_code: "zalo_token_refresh_failed",
          error_message: "Zalo access token refresh failed",
        },
        {
          outbox_id: "outbox-2",
          status: "failed",
          error_code: "zalo_token_refresh_failed",
          error_message: "Zalo access token refresh failed",
        },
      ],
    })
  })

  it("rejects when token-refresh failure state cannot be persisted", async () => {
    const rpcClient = vi
      .fn()
      .mockResolvedValueOnce([baseOutboxRow])
      .mockRejectedValueOnce(new Error("database unavailable"))
    const fetchImpl = vi.fn()
    const accessTokenProvider = vi.fn().mockRejectedValue(
      new ZbsAccessTokenRefreshError({
        code: "zalo_token_refresh_failed",
        safeMessage: "Zalo access token refresh failed",
        retryable: false,
      })
    )

    await expect(
      dispatchPendingZbsNotifications({
        dispatchEnabled: true,
        accessTokenProvider,
        repairTemplateId: "template-123",
        rpcClient,
        fetchImpl,
        now: new Date("2026-06-30T08:00:00.000Z"),
      })
    ).rejects.toThrow("Failed to persist ZBS token refresh failure state")

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_MARK_FAILED_RPC,
      args: expect.objectContaining({
        p_id: "outbox-1",
        p_error_code: "zalo_token_refresh_failed",
      }),
    })
  })
})
