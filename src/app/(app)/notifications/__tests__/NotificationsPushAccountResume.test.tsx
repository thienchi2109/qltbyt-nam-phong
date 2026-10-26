import * as React from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import { NextAuthSessionProvider } from "@/providers/session-provider"
import NotificationsPage from "../page"
import {
  mocks,
  mount,
  publicKey,
  pushRegistration,
  resetNotificationTestState,
  response,
  session,
  storeSubscription,
} from "./NotificationsPushOptInTestUtils"

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  signOut: vi.fn(),
  useSession: () => mocks.session(),
}))
vi.mock("@/contexts/TenantSelectionContext", () => ({ useTenantSelection: () => mocks.tenant() }))
vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <button>Đơn vị mục tiêu</button>,
}))

const consentKey = (ownerId: string) => `qltbyt:web-push:consent:${encodeURIComponent(ownerId)}`

function installPushApi(onRegister?: (endpoint: string) => void) {
  mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes("/public-key")) {
      return Promise.resolve(
        response({
          version: 1,
          registration_enabled: true,
          vapid: { version: "test-v1", public_key: publicKey, fingerprint: "sha256:test" },
        })
      )
    }
    if (url.endsWith("/subscriptions/revoke") && init?.method === "POST") {
      return Promise.resolve(response({ version: 1, revoked: true }))
    }
    if (url.endsWith("/subscriptions") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { subscription: { endpoint: string } }
      onRegister?.(body.subscription.endpoint)
      return Promise.resolve(
        response({
          version: 1,
          subscription_id: "00000000-0000-4000-8000-000000000002",
          revision: "2",
        })
      )
    }
    return Promise.resolve(response({ version: 1, don_vi_id: "7", candidates: [] }))
  })
}

function mountWithProvider() {
  return render(
    <NextAuthSessionProvider session={null}>
      <NotificationsPage />
    </NextAuthSessionProvider>,
    { wrapper: createReactQueryWrapper(createTestQueryClient()) }
  )
}

beforeEach(resetNotificationTestState)
afterEach(() => vi.unstubAllGlobals())

describe("Web Push account resume", () => {
  it("does not prompt automatically when permission is still default", async () => {
    const { subscribe } = pushRegistration()
    storeSubscription("owner-a", { status: "revoking" })
    window.localStorage.setItem(consentKey("owner-a"), "true")
    installPushApi()
    session("user", "owner-a")

    mountWithProvider()
    await screen.findByRole("button", { name: "Thử lại" })

    expect(subscribe).not.toHaveBeenCalled()
    expect(mocks.requestPermission).not.toHaveBeenCalled()
    expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0)
  })

  it("does not treat a legacy revoking record as consent", async () => {
    const { subscribe } = pushRegistration()
    storeSubscription("owner-a", { status: "revoking" })
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: mocks.requestPermission,
    })
    installPushApi()
    session("user", "owner-a")

    mountWithProvider()
    await screen.findByRole("button", { name: "Thử lại" })

    expect(subscribe).not.toHaveBeenCalled()
    expect(mocks.requestPermission).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(consentKey("owner-a"))).toBeNull()
    expect(window.localStorage.getItem("qltbyt:web-push:subscription:owner-a")).toContain(
      '"status":"revoking"'
    )
  })

  it("keeps failed restore intent and offers a gesture-driven reconnect without prompting again", async () => {
    const { subscribe } = pushRegistration()
    subscribe.mockRejectedValueOnce(new Error("browser requires a user gesture"))
    storeSubscription("owner-a", { status: "revoking" })
    window.localStorage.setItem(consentKey("owner-a"), "true")
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: mocks.requestPermission,
    })
    installPushApi()
    session("user", "owner-a")
    const user = userEvent.setup()

    mountWithProvider()
    await waitFor(() => expect(subscribe).toHaveBeenCalledOnce())
    await user.click(await screen.findByRole("button", { name: "Thử lại" }))
    await screen.findByText("Thông báo đã bật trên trình duyệt.")

    expect(subscribe).toHaveBeenCalledTimes(2)
    expect(mocks.requestPermission).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(consentKey("owner-a"))).toBe("true")
  })

  it("allows a returning opted-in owner to reconnect after three failed manual attempts", async () => {
    pushRegistration()
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: mocks.requestPermission,
    })
    window.localStorage.setItem(consentKey("99"), "true")
    mocks.requestPermission.mockResolvedValue("granted")
    let postCount = 0
    let recovered = false
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/public-key")) {
        return Promise.resolve(
          response({
            version: 1,
            registration_enabled: true,
            vapid: { version: "test-v1", public_key: publicKey, fingerprint: "sha256:test" },
          })
        )
      }
      if (url.endsWith("/subscriptions") && init?.method === "POST") {
        postCount += 1
        if (!recovered) return Promise.reject(new TypeError("network unavailable"))
        return Promise.resolve(
          response({
            version: 1,
            subscription_id: "00000000-0000-4000-8000-000000000003",
            revision: "3",
          })
        )
      }
      return Promise.resolve(response({ version: 1, don_vi_id: "7", candidates: [] }))
    })
    const user = userEvent.setup()
    mount()

    await screen.findByRole("button", { name: "Thử lại" })
    for (const expectedPosts of [2, 4, 6]) {
      await user.click(screen.getByRole("button", { name: "Thử lại" }))
      await waitFor(() => expect(postCount).toBe(expectedPosts))
      await waitFor(() => expect(screen.getByRole("button", { name: "Thử lại" })).toBeEnabled())
    }

    recovered = true
    await user.click(screen.getByRole("button", { name: "Thử lại" }))
    await screen.findByText("Thông báo đã bật trên trình duyệt.")
    expect(postCount).toBe(7)
    expect(mocks.requestPermission).not.toHaveBeenCalled()
  })

  it("keeps an explicit disable off after switching accounts and remounting", async () => {
    const { getSubscription, subscribe, subscription } = pushRegistration()
    let currentSubscription: typeof subscription | null = subscription
    getSubscription.mockImplementation(async () => currentSubscription)
    subscription.unsubscribe.mockImplementation(async () => {
      currentSubscription = null
      return true
    })
    window.localStorage.setItem(consentKey("owner-a"), "true")
    storeSubscription("owner-a")
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: mocks.requestPermission,
    })
    installPushApi()
    session("user", "owner-a")
    const user = userEvent.setup()
    const view = mountWithProvider()
    await screen.findByText("Thông báo đã bật trên trình duyệt.")

    await user.click(screen.getByRole("button", { name: "Tắt thông báo" }))
    await screen.findByText("Thông báo đang tắt trên trình duyệt này.")
    expect(window.localStorage.getItem(consentKey("owner-a"))).toBe("false")

    session("user", "owner-b")
    view.rerender(
      <NextAuthSessionProvider session={null}>
        <NotificationsPage />
      </NextAuthSessionProvider>
    )
    session("user", "owner-a")
    view.rerender(
      <NextAuthSessionProvider session={null}>
        <NotificationsPage />
      </NextAuthSessionProvider>
    )
    view.unmount()

    session("user", "owner-a")
    mountWithProvider()
    await screen.findByRole("button", { name: "Bật thông báo" })
    expect(subscribe).not.toHaveBeenCalled()
    expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1)
    expect(mocks.requestPermission).not.toHaveBeenCalled()
  })

  it("does not restore consent when reload races a pending explicit disable", async () => {
    const { getSubscription, subscribe, subscription } = pushRegistration()
    getSubscription.mockResolvedValue(subscription)
    let releaseUnsubscribe!: (value: boolean) => void
    subscription.unsubscribe.mockImplementation(
      () => new Promise<boolean>((resolve) => (releaseUnsubscribe = resolve))
    )
    window.localStorage.setItem(consentKey("owner-a"), "true")
    storeSubscription("owner-a")
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: mocks.requestPermission,
    })
    installPushApi()
    session("user", "owner-a")
    const user = userEvent.setup()
    const view = mountWithProvider()
    await screen.findByText("Thông báo đã bật trên trình duyệt.")

    await user.click(screen.getByRole("button", { name: "Tắt thông báo" }))
    await screen.findByText("Đang tắt thông báo trên trình duyệt...")
    expect(window.localStorage.getItem(consentKey("owner-a"))).toBe("false")
    expect(window.localStorage.getItem("qltbyt:web-push:subscription:owner-a")).toContain(
      '"status":"revoking"'
    )
    view.unmount()

    session("user", "owner-a")
    mountWithProvider()
    await screen.findByRole("button", { name: "Thử lại" })
    expect(subscribe).not.toHaveBeenCalled()
    expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0)

    await act(async () => releaseUnsubscribe(true))
  })

  it("waits for an aborted owner's late subscription to be removed before restoring the next owner", async () => {
    const { getSubscription, subscribe } = pushRegistration()
    const endpointA = "https://push.example.test/account-a"
    const endpointB = "https://push.example.test/account-b"
    let currentSubscription: { endpoint: string } | null = null
    getSubscription.mockImplementation(async () => currentSubscription)
    let releaseUnsubscribeA!: (unsubscribed: boolean) => void
    const subscriptionA = {
      endpoint: endpointA,
      toJSON: () => ({
        endpoint: endpointA,
        keys: { p256dh: publicKey, auth: "AAAAAAAAAAAAAAAAAAAAAA" },
      }),
      unsubscribe: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            releaseUnsubscribeA = (unsubscribed) => {
              currentSubscription = null
              resolve(unsubscribed)
            }
          })
      ),
    }
    let releaseSubscribeA!: (subscription: typeof subscriptionA) => void
    const subscriptionB = {
      endpoint: endpointB,
      toJSON: () => ({
        endpoint: endpointB,
        keys: { p256dh: publicKey, auth: "AAAAAAAAAAAAAAAAAAAAAA" },
      }),
      unsubscribe: vi.fn().mockResolvedValue(true),
    }
    subscribe
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseSubscribeA = resolve
          })
      )
      .mockImplementationOnce(async () => {
        currentSubscription = subscriptionB
        return subscriptionB
      })
    window.localStorage.setItem(consentKey("owner-a"), "true")
    window.localStorage.setItem(consentKey("owner-b"), "true")
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: mocks.requestPermission,
    })
    const registeredEndpoints: string[] = []
    installPushApi((endpoint) => registeredEndpoints.push(endpoint))
    session("user", "owner-a")
    const view = render(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>,
      { wrapper: createReactQueryWrapper(createTestQueryClient()) }
    )
    await waitFor(() => expect(subscribe).toHaveBeenCalledOnce())

    session("user", "owner-b")
    view.rerender(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )
    expect(subscribe).toHaveBeenCalledOnce()
    expect(registeredEndpoints).toEqual([])

    await act(async () => {
      currentSubscription = subscriptionA
      releaseSubscribeA(subscriptionA)
      await Promise.resolve()
    })
    await waitFor(() => expect(subscriptionA.unsubscribe).toHaveBeenCalledOnce())
    expect(subscribe).toHaveBeenCalledOnce()

    await act(async () => {
      releaseUnsubscribeA(true)
    })
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(registeredEndpoints).toEqual([endpointB]))
    view.unmount()
  })

  it("retries failed local cleanup before reconnecting the next owner", async () => {
    const { getSubscription, subscribe } = pushRegistration()
    const endpointA = "https://push.example.test/account-a"
    const endpointB = "https://push.example.test/account-b"
    const makeSubscription = (endpoint: string) => ({
      endpoint,
      toJSON: () => ({
        endpoint,
        keys: { p256dh: publicKey, auth: "AAAAAAAAAAAAAAAAAAAAAA" },
      }),
      unsubscribe: vi.fn().mockResolvedValue(true),
    })
    const subscriptionA = makeSubscription(endpointA)
    const subscriptionB = makeSubscription(endpointB)
    let currentSubscription: typeof subscriptionA | null = null
    let unsubscribeAttempts = 0
    getSubscription.mockImplementation(async () => currentSubscription)
    subscriptionA.unsubscribe.mockImplementation(async () => {
      unsubscribeAttempts += 1
      if (unsubscribeAttempts === 1) throw new Error("transient unsubscribe failure")
      currentSubscription = null
      return true
    })
    subscribe
      .mockImplementationOnce(async () => {
        currentSubscription = subscriptionA
        return subscriptionA
      })
      .mockImplementationOnce(async () => {
        currentSubscription = subscriptionB
        return subscriptionB
      })
    window.localStorage.setItem(consentKey("owner-a"), "true")
    window.localStorage.setItem(consentKey("owner-b"), "true")
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: mocks.requestPermission,
    })
    const registeredEndpoints: string[] = []
    installPushApi((endpoint) => registeredEndpoints.push(endpoint))
    session("user", "owner-a")
    const user = userEvent.setup()
    const view = mountWithProvider()

    await waitFor(() => expect(registeredEndpoints).toEqual([endpointA]))
    session("user", "owner-b")
    view.rerender(
      <NextAuthSessionProvider session={null}>
        <NotificationsPage />
      </NextAuthSessionProvider>
    )
    await waitFor(() => expect(subscriptionA.unsubscribe).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByRole("button", { name: "Thử lại" })).toBeEnabled())
    expect(registeredEndpoints).toEqual([endpointA])

    await user.click(screen.getByRole("button", { name: "Thử lại" }))
    await screen.findByText("Thông báo đã bật trên trình duyệt.")

    expect(subscriptionA.unsubscribe).toHaveBeenCalledTimes(2)
    expect(registeredEndpoints).toEqual([endpointA, endpointB])
    expect(mocks.requestPermission).not.toHaveBeenCalled()
    view.unmount()
  })
})
