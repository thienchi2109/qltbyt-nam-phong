import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mocks.signOut(...args),
}))

import { signOutWithReason } from "../auth-signout"

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
    mocks.updateSession.mockResolvedValue(undefined)
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
