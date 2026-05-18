import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import {
  callVmSuggest,
  type VmSuggestRequest,
} from "@/app/api/device-quota/mapping/suggest/suggestion-vm-client"

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

const VM_REQUEST: VmSuggestRequest = {
  requestId: "req-vm",
  facilityId: 17,
  catalogSignature: "catalog-1",
  unassignedSignature: "unassigned-1",
  deviceNames: [{ name: "May tho", deviceIds: [1, 2] }],
  categories: [{ id: 10, code: "A.01", name: "May tho", classification: "Loai B" }],
  options: { topK: 3 },
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("device quota VM suggestion client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv("DEVICE_QUOTA_VM_BASE_URL", "https://dqss.example.com/")
    vi.stubEnv("DEVICE_QUOTA_VM_CF_ACCESS_CLIENT_ID", "cf-id")
    vi.stubEnv("DEVICE_QUOTA_VM_CF_ACCESS_CLIENT_SECRET", "cf-secret")
    vi.stubEnv("DQSS_INTERNAL_TOKEN", "internal-token")
    vi.stubEnv("DEVICE_QUOTA_VM_TIMEOUT_MS", "8000")
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("posts to the VM suggest endpoint with Cloudflare Access and internal headers", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ requestId: "req-vm", suggestions: [] }))

    await expect(callVmSuggest(VM_REQUEST)).resolves.toEqual({
      requestId: "req-vm",
      suggestions: [],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://dqss.example.com/suggest",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "CF-Access-Client-Id": "cf-id",
          "CF-Access-Client-Secret": "cf-secret",
          "X-Internal-Token": "internal-token",
          "X-Request-Id": "req-vm",
        }),
        body: JSON.stringify(VM_REQUEST),
      }),
    )
  })

  test("sanitizes structured VM 5xx errors before they reach clients", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "VM unavailable", details: { provider: "dqss" } }, 503),
    )

    await expect(callVmSuggest(VM_REQUEST)).rejects.toMatchObject({
      message: "VM suggestion provider failed",
      status: 503,
      details: undefined,
    })
  })

  test("preserves structured VM 4xx errors for controlled client handling", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "Payload rejected", details: { field: "deviceNames" } }, 422),
    )

    await expect(callVmSuggest(VM_REQUEST)).rejects.toMatchObject({
      message: "Payload rejected",
      status: 422,
      details: { field: "deviceNames" },
    })
  })

  test("maps network failures to a controlled 503", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED"))

    await expect(callVmSuggest(VM_REQUEST)).rejects.toMatchObject({
      message: "VM suggestion provider request failed",
      status: 503,
    })
  })

  test("fails fast when required VM env is missing", async () => {
    vi.stubEnv("DEVICE_QUOTA_VM_BASE_URL", "")

    await expect(callVmSuggest(VM_REQUEST)).rejects.toThrow("Missing DEVICE_QUOTA_VM_BASE_URL")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("aborts slow VM requests with a controlled timeout", async () => {
    vi.useFakeTimers()
    vi.stubEnv("DEVICE_QUOTA_VM_TIMEOUT_MS", "5")
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("The operation was aborted")
          error.name = "AbortError"
          reject(error)
        })
      })
    })

    const pending = expect(callVmSuggest(VM_REQUEST)).rejects.toMatchObject({
      message: "VM suggestion provider timed out",
      status: 503,
    })
    await vi.advanceTimersByTimeAsync(5)

    await pending
  })
})
