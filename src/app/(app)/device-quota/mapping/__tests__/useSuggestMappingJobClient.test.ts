import { afterEach, describe, expect, test, vi } from "vitest"

import { waitForNextJobTick } from "../_hooks/useSuggestMappingJobClient"

describe("useSuggestMappingJobClient", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test("removes abort listener after a successful polling tick", async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const removeEventListenerSpy = vi.spyOn(controller.signal, "removeEventListener")

    const tick = waitForNextJobTick(controller.signal)
    await vi.advanceTimersByTimeAsync(0)
    await tick

    expect(removeEventListenerSpy).toHaveBeenCalledWith("abort", expect.any(Function))
  })
})
