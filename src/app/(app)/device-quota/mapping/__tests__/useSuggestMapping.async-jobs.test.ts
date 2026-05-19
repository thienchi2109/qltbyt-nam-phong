import { describe, test, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const callRpcMock = vi.fn()
vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}))

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

import { useSuggestMapping } from "../_hooks/useSuggestMapping"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const PREVIEW_RESULT = {
  groups: [
    {
      nhom_id: 10,
      nhom_label: "Máy thở chức năng cao",
      nhom_code: "A.01",
      phan_loai: "Loại B",
      rrf_score: 0.95,
      device_names: ["Máy thở"],
      device_ids: [1, 2, 3],
      device_name_to_ids: { "Máy thở": [1, 2, 3] },
    },
  ],
  unmatched: [{ device_name: "Máy X-quang", device_ids: [6] }],
  totalDevices: 4,
  matchedDevices: 3,
}

function setupAsyncPipeline() {
  fetchMock
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          job: {
            id: "job-1",
            processedUniqueNames: 0,
            status: "queued",
            totalUniqueNames: 3,
          },
          requestId: "req-job",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          failed: 0,
          job: {
            id: "job-1",
            processedUniqueNames: 1,
            status: "processing",
            totalUniqueNames: 3,
          },
          processed: 1,
          requestId: "req-process-1",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          failed: 0,
          job: {
            id: "job-1",
            processedUniqueNames: 3,
            result: PREVIEW_RESULT,
            status: "succeeded",
            totalUniqueNames: 3,
          },
          processed: 1,
          requestId: "req-process-2",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
}

describe("useSuggestMapping async jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  test("creates an async suggestion job and transitions into processing immediately", async () => {
    let resolveJob!: (value: Response) => void
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => {
        resolveJob = resolve
      }),
    )
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => undefined))

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.status).toBe("starting-job")
    })

    await act(async () => {
      resolveJob(
        new Response(
          JSON.stringify({
            job: {
              id: "job-1",
              processedUniqueNames: 0,
              status: "queued",
              totalUniqueNames: 3,
            },
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      )
    })

    await waitFor(() => {
      expect(result.current.status).toBe("processing")
    })
    expect(result.current.processedUniqueNames).toBe(0)
    expect(result.current.totalUniqueNames).toBe(3)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/device-quota/mapping/suggest/jobs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ donViId: 1 }),
      }),
    )
  })

  test("processes and polls an async job until success", async () => {
    setupAsyncPipeline()

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    expect(result.current.result).toEqual(PREVIEW_RESULT)
    expect(result.current.progress).toBe(100)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/device-quota/mapping/suggest/jobs",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/device-quota/mapping/suggest/jobs/job-1/process",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/device-quota/mapping/suggest/jobs/job-1/process",
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("reuses an existing running async job as processing", async () => {
    let resolveProcess!: (value: Response) => void
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            job: {
              id: "job-existing",
              processedUniqueNames: 2,
              status: "processing",
              totalUniqueNames: 3,
            },
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => {
          resolveProcess = resolve
        }),
      )

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.status).toBe("processing")
    })
    expect(result.current.processedUniqueNames).toBe(2)

    await act(async () => {
      resolveProcess(
        new Response(
          JSON.stringify({
            failed: 0,
            job: {
              id: "job-existing",
              processedUniqueNames: 3,
              result: PREVIEW_RESULT,
              status: "succeeded",
              totalUniqueNames: 3,
            },
            processed: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
    })

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })
    expect(result.current.result).toEqual(PREVIEW_RESULT)
  })

  test("failed async jobs expose a retry action that resumes processing", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            job: {
              id: "job-1",
              processedUniqueNames: 0,
              status: "queued",
              totalUniqueNames: 3,
            },
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            failed: 1,
            job: {
              error: "VM timeout",
              id: "job-1",
              processedUniqueNames: 1,
              status: "failed",
              totalUniqueNames: 3,
            },
            processed: 0,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            job: {
              id: "job-1",
              processedUniqueNames: 1,
              status: "processing",
              totalUniqueNames: 3,
            },
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            failed: 0,
            job: {
              id: "job-1",
              processedUniqueNames: 3,
              result: PREVIEW_RESULT,
              status: "succeeded",
              totalUniqueNames: 3,
            },
            processed: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })
    expect(result.current.error).toBe("VM timeout")
    expect(result.current.canRetry).toBe(true)

    await act(async () => {
      result.current.retryFailedJob()
    })

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })
    expect(result.current.result).toEqual(PREVIEW_RESULT)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/device-quota/mapping/suggest/jobs/job-1/retry",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
