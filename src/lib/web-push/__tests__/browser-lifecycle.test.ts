import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { signOutWithReason } from "@/lib/auth-signout"
import {
  cleanupBrowserSubscription,
  readBrowserSubscriptionRecord,
  writeBrowserSubscriptionRecord,
} from "../browser-lifecycle"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mocks.signOut(...args),
}))

const ENDPOINT = "https://push.example.test/subscription"

function record(ownerId: string, status: "enabled" | "revoking" = "enabled") {
  return {
    version: 1 as const,
    ownerId,
    vapidKeyVersion: "test-v1",
    status,
    endpoint: ENDPOINT,
    subscriptionId: "00000000-0000-4000-8000-000000000001",
    revision: "1",
  }
}

function installBrowser(
  subscription: { endpoint: string; unsubscribe: () => Promise<boolean> } | null,
  online: boolean
) {
  const registration = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(subscription),
    },
  }
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  })
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: online,
  })
  return registration
}

describe("browser Web Push lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    vi.stubGlobal("fetch", mocks.fetch)
    vi.stubGlobal("BroadcastChannel", undefined)
    mocks.signOut.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, "serviceWorker")
    Reflect.deleteProperty(navigator, "onLine")
    window.localStorage.clear()
  })

  it("keeps logout bounded, unsubscribes locally, and leaves remote revoke pending offline", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true)
    installBrowser({ endpoint: ENDPOINT, unsubscribe }, false)
    writeBrowserSubscriptionRecord(record("owner-a"))

    await signOutWithReason({ reason: "user_initiated", userId: "owner-a" })

    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
    expect(readBrowserSubscriptionRecord("owner-a")).toEqual(
      expect.objectContaining({ status: "revoking" })
    )
  })

  it("retains another owner record when one browser cleanup fails", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true)
    installBrowser({ endpoint: ENDPOINT, unsubscribe }, true)
    writeBrowserSubscriptionRecord(record("owner-a"))
    writeBrowserSubscriptionRecord({
      ...record("owner-b"),
      subscriptionId: "00000000-0000-4000-8000-000000000002",
      revision: "2",
    })
    mocks.fetch.mockRejectedValue(new TypeError("network unavailable"))

    const result = await cleanupBrowserSubscription("owner-a")

    expect(result).toBe("pending")
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(readBrowserSubscriptionRecord("owner-a")).toEqual(
      expect.objectContaining({ status: "revoking" })
    )
    expect(readBrowserSubscriptionRecord("owner-b")).toEqual(
      expect.objectContaining({ status: "enabled" })
    )
  })
})
