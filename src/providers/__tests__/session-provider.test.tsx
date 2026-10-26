import * as React from "react"
import { act, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  SessionProvider: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  )),
  signOut: vi.fn(),
  useSession: vi.fn(() => ({ data: null })),
  cleanupBrowserSubscription: vi.fn(),
  discardLocalBrowserSubscription: vi.fn(),
  readBrowserSubscriptionRecord: vi.fn(() => null),
  readStoredBrowserSubscriptionOwnerIds: vi.fn(() => []),
  readPublicKey: vi.fn(),
  registerBrowserSubscription: vi.fn(),
  invalidateQueries: vi.fn(),
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mocks.invalidateQueries(...args),
  }),
}))

vi.mock("next-auth/react", () => ({
  SessionProvider: mocks.SessionProvider,
  signOut: (...args: unknown[]) => mocks.signOut(...args),
  useSession: () => mocks.useSession(),
}))

vi.mock("@/lib/web-push/browser-lifecycle", () => ({
  cleanupBrowserSubscription: (...args: unknown[]) => mocks.cleanupBrowserSubscription(...args),
  discardLocalBrowserSubscription: (...args: unknown[]) =>
    mocks.discardLocalBrowserSubscription(...args),
  readStoredBrowserSubscriptionOwnerIds: () => mocks.readStoredBrowserSubscriptionOwnerIds(),
  readBrowserSubscriptionRecord: (...args: unknown[]) =>
    mocks.readBrowserSubscriptionRecord(...args),
}))

vi.mock("@/lib/web-push/browser-registration", () => ({
  readPublicKey: (...args: unknown[]) => mocks.readPublicKey(...args),
  registerBrowserSubscription: (...args: unknown[]) => mocks.registerBrowserSubscription(...args),
  VAPID_VERSION_STORAGE_KEY: "web-push-vapid-key-version",
}))

import { NextAuthSessionProvider } from "../session-provider"

type BroadcastHandler = ((event: MessageEvent) => void) | null

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []

  readonly name: string
  onmessage: BroadcastHandler = null
  closed = false

  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.instances.push(this)
  }

  postMessage(): void {}

  close(): void {
    this.closed = true
  }
}

describe("NextAuthSessionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel)
    window.localStorage.clear()
    FakeBroadcastChannel.instances = []
    mocks.signOut.mockResolvedValue(undefined)
    mocks.cleanupBrowserSubscription.mockResolvedValue("remote")
    mocks.discardLocalBrowserSubscription.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it("configures NextAuth to refresh sessions within the password-change invalidation SLA", () => {
    render(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    expect(mocks.SessionProvider).toHaveBeenCalledOnce()
    expect(mocks.SessionProvider.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        session: null,
        refetchInterval: 60,
        refetchOnWindowFocus: true,
      })
    )
  })

  it("signs out the current tab when a sibling tab broadcasts a forced password-change signout", async () => {
    render(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    const channel = FakeBroadcastChannel.instances[0]
    channel.onmessage?.({
      data: {
        type: "auth:signout",
        reason: "forced_password_change",
        callbackUrl: "/",
        issuedAt: Date.now(),
        sourceId: "other-tab",
      },
    } as MessageEvent)

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
    })
  })

  it("cleans the authenticated owner before handling a sibling-tab signout", async () => {
    window.localStorage.setItem("qltbyt:web-push:consent:owner-a", "true")
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-a" } },
    })
    render(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    const channel = FakeBroadcastChannel.instances[0]
    channel.onmessage?.({
      data: {
        type: "auth:signout",
        reason: "forced_password_change",
        callbackUrl: "/",
        issuedAt: Date.now(),
        sourceId: "other-tab",
      },
    } as MessageEvent)

    await waitFor(() => {
      expect(mocks.cleanupBrowserSubscription).toHaveBeenCalledWith("owner-a")
      expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
      expect(window.localStorage.getItem("qltbyt:web-push:consent:owner-a")).toBe("false")
    })
  })

  it("does not restore after consent is withdrawn while the public key is loading", async () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-a" } },
    })
    vi.stubGlobal("Notification", { permission: "granted" })
    window.localStorage.setItem("qltbyt:web-push:consent:owner-a", "true")
    let releaseKey!: (value: {
      registration_enabled: boolean
      vapid: { version: string; public_key: string } | null
    }) => void
    mocks.readPublicKey.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseKey = resolve
      })
    )

    render(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )
    await waitFor(() => expect(mocks.readPublicKey).toHaveBeenCalledOnce())

    window.localStorage.setItem("qltbyt:web-push:consent:owner-a", "false")
    await act(async () => {
      releaseKey({
        registration_enabled: true,
        vapid: { version: "test-v1", public_key: "test-public-key" },
      })
    })
    await waitFor(() => expect(mocks.invalidateQueries).toHaveBeenCalledOnce())

    expect(mocks.registerBrowserSubscription).not.toHaveBeenCalled()
  })

  it("uses the storage fallback when BroadcastChannel is unavailable", async () => {
    vi.stubGlobal("BroadcastChannel", undefined)

    render(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "qltbyt:auth-signout",
        newValue: JSON.stringify({
          type: "auth:signout",
          reason: "forced_password_change",
          callbackUrl: "/",
          issuedAt: Date.now(),
          sourceId: "other-tab",
        }),
      })
    )

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
    })
  })

  it("logs broadcast-triggered signout failures with callback context", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const error = new Error("signout failed")
    mocks.signOut.mockRejectedValueOnce(error)

    render(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    const channel = FakeBroadcastChannel.instances[0]
    channel.onmessage?.({
      data: {
        type: "auth:signout",
        reason: "forced_password_change",
        callbackUrl: "/",
        issuedAt: Date.now(),
        sourceId: "other-tab",
      },
    } as MessageEvent)

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("subscribeAuthSignout failed to sign out", {
        callbackUrl: "/",
        error,
      })
    })

    consoleErrorSpy.mockRestore()
  })

  it("preserves the previous owner through logout and cleans it before a new owner", async () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-a" } },
    })
    const view = render(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    mocks.useSession.mockReturnValue({ status: "unauthenticated", data: null })
    view.rerender(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    expect(mocks.discardLocalBrowserSubscription).not.toHaveBeenCalled()

    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-b" } },
    })
    view.rerender(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )
    await waitFor(() => expect(mocks.discardLocalBrowserSubscription).toHaveBeenCalledTimes(1))
  })

  it("preserves the previous owner across same-account relogin", async () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-a" } },
    })
    const view = render(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    mocks.useSession.mockReturnValue({ status: "unauthenticated", data: null })
    view.rerender(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-a" } },
    })
    view.rerender(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    expect(mocks.discardLocalBrowserSubscription).not.toHaveBeenCalled()
  })

  it("keeps the previous owner across session loading and cleans it once before a new owner", async () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-a" } },
    })
    const view = render(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    mocks.useSession.mockReturnValue({ status: "loading", data: null })
    view.rerender(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )
    expect(mocks.discardLocalBrowserSubscription).not.toHaveBeenCalled()

    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "owner-b" } },
    })
    view.rerender(
      <NextAuthSessionProvider session={null}>
        <div>child</div>
      </NextAuthSessionProvider>
    )

    await waitFor(() => {
      expect(mocks.discardLocalBrowserSubscription).toHaveBeenCalledTimes(1)
      expect(mocks.discardLocalBrowserSubscription).toHaveBeenCalledWith("owner-a")
    })
  })
})
