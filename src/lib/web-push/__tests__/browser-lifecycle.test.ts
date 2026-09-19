import * as React from "react"
import { act, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readPreflight } from "@/app/(app)/notifications/NotificationsPushOptInLifecycle"
import { signOutWithReason } from "@/lib/auth-signout"
import { NextAuthSessionProvider } from "@/providers/session-provider"
import {
  cleanupBrowserSubscription,
  readBrowserSubscriptionRecord,
  retryBrowserSubscriptionCleanup,
  waitForPendingBrowserSubscriptionCleanup,
  writeBrowserSubscriptionRecord,
} from "../browser-lifecycle"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  signOut: (...args: unknown[]) => mocks.signOut(...args),
  useSession: () => mocks.useSession(),
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

function renderSessionProvider() {
  return render(
    React.createElement(
      NextAuthSessionProvider,
      { session: null },
      React.createElement("div", null, "child")
    )
  )
}

describe("browser Web Push lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    vi.stubGlobal("fetch", mocks.fetch)
    vi.stubGlobal("BroadcastChannel", undefined)
    mocks.signOut.mockResolvedValue(undefined)
    mocks.useSession.mockReturnValue({ status: "unauthenticated", data: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, "serviceWorker")
    Reflect.deleteProperty(navigator, "onLine")
    window.localStorage.clear()
  })

  it("preserves the opted-in subscription across explicit logout and same-owner relogin", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true)
    installBrowser({ endpoint: ENDPOINT, unsubscribe }, true)
    const expectedRecord = record("owner-a")
    writeBrowserSubscriptionRecord(expectedRecord)
    vi.stubGlobal("Notification", { permission: "default" })
    vi.stubGlobal("PushManager", class PushManager {})
    mocks.fetch.mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            version: 1,
            registration_enabled: true,
            vapid: { version: "test-v1", public_key: "test-public-key" },
          }),
          { status: 200 }
        )
    )
    expect((await readPreflight("owner-a")).state).toBe("enabled")
    expect((await readPreflight("owner-a")).state).toBe("enabled")
    mocks.fetch.mockClear()

    await signOutWithReason({ reason: "user_initiated", userId: "owner-a" })

    expect(unsubscribe).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
    expect(readBrowserSubscriptionRecord("owner-a")).toEqual(expectedRecord)

    expect((await readPreflight("owner-a")).state).toBe("enabled")
    expect(mocks.fetch).toHaveBeenCalledOnce()
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

    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ version: 1, revoked: true }), { status: 200 })
    )
    expect(await retryBrowserSubscriptionCleanup("owner-a")).toBe("remote")
    expect(readBrowserSubscriptionRecord("owner-a")).toBeNull()
    expect(readBrowserSubscriptionRecord("owner-b")).toEqual(
      expect.objectContaining({ status: "enabled" })
    )
  })

  it("preserves the opted-in subscription across mounted session expiry", async () => {
    const sessionState = {
      status: "authenticated",
      data: { user: { id: "owner-a" } },
    }
    const unsubscribe = vi.fn().mockResolvedValue(true)
    installBrowser({ endpoint: ENDPOINT, unsubscribe }, true)
    const expectedRecord = record("owner-a")
    writeBrowserSubscriptionRecord(expectedRecord)
    mocks.useSession.mockImplementation(() => sessionState)

    const view = render(
      React.createElement(
        NextAuthSessionProvider,
        { session: null },
        React.createElement("div", null, "child")
      )
    )

    await act(async () => {
      sessionState.status = "unauthenticated"
      sessionState.data = null
      view.rerender(
        React.createElement(
          NextAuthSessionProvider,
          { session: null },
          React.createElement("div", null, "child")
        )
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(unsubscribe).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(readBrowserSubscriptionRecord("owner-a")).toEqual(expectedRecord)
  })

  it("preserves the same owner's subscription across provider remount after logout", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true)
    installBrowser({ endpoint: ENDPOINT, unsubscribe }, true)
    const expectedRecord = record("owner-a")
    writeBrowserSubscriptionRecord(expectedRecord)
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-a" } },
    })

    const firstView = renderSessionProvider()
    await signOutWithReason({ reason: "user_initiated", userId: "owner-a" })
    firstView.unmount()

    const secondView = renderSessionProvider()

    expect(unsubscribe).not.toHaveBeenCalled()
    expect(readBrowserSubscriptionRecord("owner-a")).toEqual(expectedRecord)
    secondView.unmount()
  })

  it("cleans the persisted previous owner before a different owner can register after remount", async () => {
    let subscribed = true
    let resolveUnsubscribe!: (value: boolean) => void
    const unsubscribe = vi.fn().mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveUnsubscribe = (value) => {
            subscribed = false
            resolve(value)
          }
        })
    )
    const registration = installBrowser({ endpoint: ENDPOINT, unsubscribe }, true)
    registration.pushManager.getSubscription.mockImplementation(async () =>
      subscribed ? { endpoint: ENDPOINT, unsubscribe } : null
    )
    writeBrowserSubscriptionRecord(record("owner-a"))

    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-a" } },
    })
    const firstView = renderSessionProvider()
    await signOutWithReason({ reason: "user_initiated", userId: "owner-a" })
    firstView.unmount()

    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-b" } },
    })
    const secondView = renderSessionProvider()

    await waitFor(() => expect(unsubscribe).toHaveBeenCalledOnce())
    let registered = false
    const pending = waitForPendingBrowserSubscriptionCleanup().then(() => {
      registered = true
    })
    await Promise.resolve()
    expect(registered).toBe(false)
    resolveUnsubscribe(true)
    await pending

    expect(registered).toBe(true)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(readBrowserSubscriptionRecord("owner-a")).toEqual(
      expect.objectContaining({ status: "revoking" })
    )
    secondView.unmount()
  })

  it("blocks a different owner when persisted cleanup fails after remount", async () => {
    const unsubscribe = vi.fn().mockRejectedValue(new Error("browser cleanup failed"))
    installBrowser({ endpoint: ENDPOINT, unsubscribe }, true)
    writeBrowserSubscriptionRecord(record("owner-a"))

    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-a" } },
    })
    const firstView = renderSessionProvider()
    await signOutWithReason({ reason: "user_initiated", userId: "owner-a" })
    firstView.unmount()

    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-b" } },
    })
    const secondView = renderSessionProvider()

    await waitFor(() => expect(unsubscribe).toHaveBeenCalledOnce())
    await expect(waitForPendingBrowserSubscriptionCleanup()).rejects.toThrow(
      "web_push_cleanup_failed"
    )
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(readBrowserSubscriptionRecord("owner-a")).toEqual(
      expect.objectContaining({ status: "revoking" })
    )
    secondView.unmount()
  })

  it("blocks a new owner when persisted cleanup probing is unavailable", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true)
    const registration = installBrowser({ endpoint: ENDPOINT, unsubscribe }, true)
    registration.pushManager.getSubscription.mockRejectedValue(
      new Error("service worker unavailable")
    )
    writeBrowserSubscriptionRecord(record("owner-a", "revoking"))

    await expect(waitForPendingBrowserSubscriptionCleanup()).rejects.toThrow(
      "service worker unavailable"
    )
  })

  it("leaves a stored owner untouched when cold-start hydration expires without an owner", async () => {
    const sessionState = { status: "loading", data: null as { user: { id: string } } | null }
    const unsubscribe = vi.fn().mockResolvedValue(true)
    installBrowser({ endpoint: ENDPOINT, unsubscribe }, true)
    writeBrowserSubscriptionRecord(record("owner-a"))
    mocks.useSession.mockImplementation(() => sessionState)

    const view = render(
      React.createElement(
        NextAuthSessionProvider,
        { session: null },
        React.createElement("div", null, "child")
      )
    )

    await act(async () => {
      sessionState.status = "unauthenticated"
      view.rerender(
        React.createElement(
          NextAuthSessionProvider,
          { session: null },
          React.createElement("div", null, "child")
        )
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(unsubscribe).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(readBrowserSubscriptionRecord("owner-a")).toEqual(
      expect.objectContaining({ status: "enabled" })
    )
  })
})
