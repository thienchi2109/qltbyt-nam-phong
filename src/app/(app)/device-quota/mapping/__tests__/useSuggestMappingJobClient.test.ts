import { afterEach, describe, expect, test, vi } from "vitest"

import {
  getJobResult,
  waitForNextJobTick,
  type SuggestionJob,
} from "../_hooks/useSuggestMappingJobClient"

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

  test("rejects completed jobs with malformed result payloads", () => {
    const job = {
      error: null,
      id: "job-1",
      processedUniqueNames: 1,
      result: { groups: [], unmatched: [] },
      status: "succeeded",
      totalUniqueNames: 1,
    } as unknown as SuggestionJob

    expect(() => getJobResult(job)).toThrow("Suggestion job completed without a valid result")
  })
})
