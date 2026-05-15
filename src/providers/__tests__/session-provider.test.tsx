import * as React from "react"
import { render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  SessionProvider: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  )),
  signOut: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  SessionProvider: mocks.SessionProvider,
  signOut: (...args: unknown[]) => mocks.signOut(...args),
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

    expect(mocks.SessionProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        session: null,
        refetchInterval: 60,
        refetchOnWindowFocus: true,
      }),
      expect.anything()
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
})
