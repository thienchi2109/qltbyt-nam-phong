import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  updateSession: vi.fn(),
  broadcastPostMessage: vi.fn(),
  broadcastClose: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mocks.signOut(...args),
}))

import { signOutWithReason } from "../auth-signout"

class FakeBroadcastChannel {
  readonly name: string

  constructor(name: string) {
    this.name = name
  }

  postMessage(message: unknown): void {
    mocks.broadcastPostMessage(message)
  }

  close(): void {
    mocks.broadcastClose()
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve
    reject = innerReject
  })

  return { promise, resolve, reject }
}

describe("signOutWithReason", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"))
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel)
    window.localStorage.clear()
    mocks.updateSession.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it("awaits the session reason update before signing out", async () => {
    const deferred = createDeferred<void>()
    mocks.updateSession.mockReturnValueOnce(deferred.promise)

    const signOutPromise = signOutWithReason({
      updateSession: mocks.updateSession,
      reason: "user_initiated",
    })

    await Promise.resolve()

    expect(mocks.updateSession).toHaveBeenCalledWith({
      pending_signout_reason: "user_initiated",
    })
    expect(mocks.signOut).not.toHaveBeenCalled()

    deferred.resolve()
    await signOutPromise

    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
  })

  it("waits the requested delay before signing out", async () => {
    const signOutPromise = signOutWithReason({
      updateSession: mocks.updateSession,
      reason: "forced_password_change",
      delayMs: 1_500,
    })

    await Promise.resolve()
    expect(mocks.signOut).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_499)
    expect(mocks.signOut).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
    expect(mocks.updateSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]
    )

    await signOutPromise
  })

  it("calls signOut even when updateSession rejects", async () => {
    mocks.updateSession.mockRejectedValueOnce(new Error("session update failed"))

    await signOutWithReason({
      updateSession: mocks.updateSession,
      reason: "user_initiated",
    })

    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
  })

  it("broadcasts signout intent to sibling tabs before redirecting the current tab", async () => {
    await signOutWithReason({
      updateSession: mocks.updateSession,
      reason: "forced_password_change",
      callbackUrl: "/",
    })

    expect(mocks.broadcastPostMessage).toHaveBeenCalledWith({
      type: "auth:signout",
      reason: "forced_password_change",
      callbackUrl: "/",
      issuedAt: Date.parse("2026-05-15T12:00:00.000Z"),
      sourceId: expect.any(String),
    })
    expect(mocks.broadcastClose).toHaveBeenCalled()
    expect(window.localStorage.getItem("qltbyt:auth-signout")).toContain("forced_password_change")
    expect(mocks.broadcastPostMessage.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]
    )
  })

  it("broadcasts sibling-tab signout before waiting the current-tab redirect delay", async () => {
    const signOutPromise = signOutWithReason({
      updateSession: mocks.updateSession,
      reason: "forced_password_change",
      delayMs: 1_500,
    })

    await vi.waitFor(() => {
      expect(mocks.broadcastPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "auth:signout",
          reason: "forced_password_change",
        })
      )
    })
    expect(mocks.signOut).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_500)
    await signOutPromise
  })

  it("falls back to signOut when updateSession hangs", async () => {
    const deferred = createDeferred<void>()
    mocks.updateSession.mockReturnValueOnce(deferred.promise)

    const signOutPromise = signOutWithReason({
      updateSession: mocks.updateSession,
      reason: "user_initiated",
    })

    await Promise.resolve()
    expect(mocks.signOut).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(999)
    expect(mocks.signOut).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })

    deferred.resolve()
    await signOutPromise
  })
})
