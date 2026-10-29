import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { hasBrowserPushConsent, setBrowserPushConsent } from "../browser-consent"
import { readBrowserSubscriptionRecord, writeBrowserSubscriptionRecord } from "../browser-lifecycle"
import { registerBrowserSubscription } from "../browser-registration"

const vapid = { version: "test-v1", public_key: "AQID" }

function installBrowser() {
  let current: PushSubscription | null = null
  const getSubscription = vi.fn(async () => current)
  const subscribe = vi.fn(async () => {
    current = subscription
    return subscription
  })
  const subscription = {
    endpoint: "https://push.example.test/account-a",
    toJSON: () => ({
      endpoint: "https://push.example.test/account-a",
      keys: { p256dh: "AQID", auth: "BAUG" },
    }),
    unsubscribe: vi.fn(async () => {
      current = null
      return true
    }),
  } as unknown as PushSubscription
  const registration = { pushManager: { getSubscription, subscribe } }
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  })
  vi.stubGlobal("fetch", vi.fn())
  return { subscribe, subscription }
}

beforeEach(() => {
  window.localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, "serviceWorker")
  window.localStorage.clear()
})

describe("browser Web Push registration consent", () => {
  it("reuses matching enabled metadata without proving registration in a replacement store", async () => {
    const { subscribe, subscription } = installBrowser()
    await subscribe()
    subscribe.mockClear()
    const stored = {
      version: 1 as const,
      ownerId: "owner-a",
      vapidKeyVersion: vapid.version,
      status: "enabled" as const,
      endpoint: subscription.endpoint,
      subscriptionId: "00000000-0000-4000-8000-000000000002",
      revision: "9007199254740993",
    }
    writeBrowserSubscriptionRecord(stored)
    setBrowserPushConsent("owner-a", true)

    await expect(
      registerBrowserSubscription(
        "owner-a",
        vapid,
        false,
        new AbortController().signal,
        undefined,
        true
      )
    ).resolves.toEqual({
      subscriptionId: stored.subscriptionId,
      revision: stored.revision,
      endpoint: stored.endpoint,
    })

    expect(fetch).not.toHaveBeenCalled()
    expect(subscribe).not.toHaveBeenCalled()
    expect(readBrowserSubscriptionRecord("owner-a")).toEqual(stored)
  })

  it("unsubscribes a native subscription that resolves after opt-out", async () => {
    const { subscribe, subscription } = installBrowser()
    let resolveSubscribe!: (value: PushSubscription) => void
    subscribe.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSubscribe = resolve
        })
    )
    setBrowserPushConsent("owner-a", true)

    const registration = registerBrowserSubscription(
      "owner-a",
      vapid,
      false,
      new AbortController().signal,
      undefined,
      true
    )
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledOnce())
    setBrowserPushConsent("owner-a", false)
    resolveSubscribe(subscription)

    await expect(registration).rejects.toThrow("Operation cancelled")
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("removes a new endpoint when consent is withdrawn during the registration request", async () => {
    const { subscribe, subscription } = installBrowser()
    let resolveFetch!: (response: Response) => void
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )
    setBrowserPushConsent("owner-a", true)

    const registration = registerBrowserSubscription(
      "owner-a",
      vapid,
      false,
      new AbortController().signal,
      undefined,
      true
    )
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    setBrowserPushConsent("owner-a", false)

    await expect(registration).rejects.toThrow("Operation cancelled")
    expect(subscribe).toHaveBeenCalledOnce()
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    const latePayload = {
      version: 1,
      subscription_id: "00000000-0000-4000-8000-000000000002",
      revision: "2",
    }
    const lateResponse = new Response(JSON.stringify(latePayload), { status: 200 })
    const readLateBody = vi.spyOn(lateResponse, "json")
    resolveFetch(lateResponse)
    await vi.waitFor(() => expect(readLateBody).toHaveResolvedWith(latePayload))
    // Drain continuations queued by the consumed response before checking persisted state.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(hasBrowserPushConsent("owner-a")).toBe(false)
    expect(readBrowserSubscriptionRecord("owner-a")?.status).toBe("unconfirmed")
  })
})
