import { describe, expect, it, vi } from "vitest"

import {
  ZBS_TOKEN_STATE_GET_RPC,
  ZBS_TOKEN_STATE_PERSIST_SUCCESS_RPC,
  ZBS_TOKEN_STATE_RECORD_ERROR_RPC,
  ZALO_OA_ACCESS_TOKEN_ENDPOINT,
  ZbsAccessTokenRefreshError,
  getValidZbsAccessToken,
} from "../access-token-manager"

const now = new Date("2026-07-01T00:00:00.000Z")

describe("getValidZbsAccessToken", () => {
  it("uses a still-valid stored access token without refreshing", async () => {
    const rpcClient = vi.fn().mockResolvedValueOnce([
      {
        access_token: "stored-access-token",
        access_token_expires_at: "2026-07-01T03:00:00.000Z",
        refresh_token: "stored-refresh-token",
      },
    ])
    const fetchImpl = vi.fn()

    const token = await getValidZbsAccessToken({
      appId: "app-id",
      appSecret: "app-secret",
      initialRefreshToken: "bootstrap-refresh-token",
      rpcClient,
      fetchImpl,
      now,
    })

    expect(token).toBe("stored-access-token")
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(rpcClient).toHaveBeenCalledTimes(1)
    expect(rpcClient).toHaveBeenCalledWith({
      fn: ZBS_TOKEN_STATE_GET_RPC,
      args: { p_provider: "zalo_zbs" },
    })
  })

  it("refreshes a near-expired token and persists the rotated refresh token", async () => {
    const rpcClient = vi
      .fn()
      .mockResolvedValueOnce([
        {
          access_token: "old-access-token",
          access_token_expires_at: "2026-07-01T00:04:00.000Z",
          refresh_token: "old-refresh-token",
        },
      ])
      .mockResolvedValueOnce([{ provider: "zalo_zbs" }])
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: "90000",
          refresh_expires_in: "7776000",
        }),
        { status: 200 }
      )
    )

    const token = await getValidZbsAccessToken({
      appId: "app-id",
      appSecret: "app-secret",
      rpcClient,
      fetchImpl,
      now,
    })

    expect(token).toBe("new-access-token")
    expect(fetchImpl).toHaveBeenCalledWith(
      ZALO_OA_ACCESS_TOKEN_ENDPOINT,
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key: "app-secret",
        },
        body: expect.any(URLSearchParams),
      })
    )
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).toBe(
      "app_id=app-id&grant_type=refresh_token&refresh_token=old-refresh-token"
    )
    expect(rpcClient).toHaveBeenNthCalledWith(2, {
      fn: ZBS_TOKEN_STATE_PERSIST_SUCCESS_RPC,
      args: {
        p_provider: "zalo_zbs",
        p_previous_refresh_token: "old-refresh-token",
        p_access_token: "new-access-token",
        p_access_token_expires_at: "2026-07-02T01:00:00.000Z",
        p_refresh_token: "new-refresh-token",
        p_refresh_token_issued_at: "2026-07-01T00:00:00.000Z",
        p_refresh_token_expires_at: "2026-09-29T00:00:00.000Z",
      },
    })
  })

  it("uses the bootstrap refresh token when durable state is empty", async () => {
    const rpcClient = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ provider: "zalo_zbs" }])
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
        }),
        { status: 200 }
      )
    )

    await expect(
      getValidZbsAccessToken({
        appId: "app-id",
        appSecret: "app-secret",
        initialRefreshToken: "bootstrap-refresh-token",
        rpcClient,
        fetchImpl,
        now,
      })
    ).resolves.toBe("new-access-token")

    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).toBe(
      "app_id=app-id&grant_type=refresh_token&refresh_token=bootstrap-refresh-token"
    )
    expect(rpcClient).toHaveBeenNthCalledWith(2, {
      fn: ZBS_TOKEN_STATE_PERSIST_SUCCESS_RPC,
      args: expect.objectContaining({
        p_previous_refresh_token: null,
        p_refresh_token: "new-refresh-token",
      }),
    })
  })

  it("records provider refresh failures without leaking tokens", async () => {
    const rpcClient = vi
      .fn()
      .mockResolvedValueOnce([
        {
          access_token: "old-access-token",
          access_token_expires_at: "2026-07-01T00:01:00.000Z",
          refresh_token: "leaked-old-refresh-token",
        },
      ])
      .mockResolvedValueOnce([{ provider: "zalo_zbs" }])
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: -201,
          message: "Refresh token invalid",
          access_token: "leaked-new-access-token",
          refresh_token: "leaked-new-refresh-token",
        }),
        { status: 200 }
      )
    )

    await expect(
      getValidZbsAccessToken({
        appId: "app-id",
        appSecret: "app-secret",
        rpcClient,
        fetchImpl,
        now,
      })
    ).rejects.toMatchObject({
      code: "zalo_token_refresh_failed",
      retryable: false,
      safeMessage: "Zalo access token refresh failed",
    })

    const error = await getRejectedError(() =>
      getValidZbsAccessToken({
        appId: "app-id",
        appSecret: "app-secret",
        rpcClient: vi.fn().mockResolvedValueOnce([
          {
            access_token: "old-access-token",
            access_token_expires_at: "2026-07-01T00:01:00.000Z",
            refresh_token: "leaked-old-refresh-token",
          },
        ]),
        fetchImpl: vi.fn().mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: -201,
              message: "Refresh token invalid",
              access_token: "leaked-new-access-token",
              refresh_token: "leaked-new-refresh-token",
            }),
            { status: 200 }
          )
        ),
        now,
      })
    )
    expect(error.message).not.toContain("leaked-")
    expect(error).toBeInstanceOf(ZbsAccessTokenRefreshError)
    expect(rpcClient).toHaveBeenNthCalledWith(2, {
      fn: ZBS_TOKEN_STATE_RECORD_ERROR_RPC,
      args: {
        p_provider: "zalo_zbs",
        p_previous_refresh_token: "leaked-old-refresh-token",
        p_error_code: "zalo_token_refresh_failed",
        p_error_message: "Zalo access token refresh failed",
        p_error_at: "2026-07-01T00:00:00.000Z",
      },
    })
  })
})

async function getRejectedError(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run()
  } catch (error) {
    if (error instanceof Error) {
      return error
    }
  }

  throw new Error("Expected promise to reject with Error")
}
