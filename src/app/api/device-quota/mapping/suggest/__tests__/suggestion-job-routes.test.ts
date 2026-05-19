import { beforeEach, describe, expect, test, vi } from "vitest"

const getServerSessionMock = vi.fn()
vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock("@/auth/config", () => ({
  authOptions: {},
}))

const createSuggestionJobMock = vi.fn()
const getSuggestionJobMock = vi.fn()
const processSuggestionJobChunksForJobMock = vi.fn()
const retrySuggestionJobMock = vi.fn()
vi.mock("@/app/api/device-quota/mapping/suggest/suggestion-job-service", () => ({
  createSuggestionJob: (...args: unknown[]) => createSuggestionJobMock(...args),
  getSuggestionJob: (...args: unknown[]) => getSuggestionJobMock(...args),
  processSuggestionJobChunksForJob: (...args: unknown[]) => processSuggestionJobChunksForJobMock(...args),
  retrySuggestionJob: (...args: unknown[]) => retrySuggestionJobMock(...args),
}))

const SESSION = {
  user: {
    id: "user-1",
    role: "to_qltb",
    don_vi: "17",
  },
}

const FORBIDDEN_SESSION = {
  user: {
    id: "user-1",
    role: "qltb_khoa",
    don_vi: "17",
  },
}

describe("device quota suggestion job routes", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doUnmock("@/lib/rbac")
    getServerSessionMock.mockReset()
    createSuggestionJobMock.mockReset()
    getSuggestionJobMock.mockReset()
    processSuggestionJobChunksForJobMock.mockReset()
    retrySuggestionJobMock.mockReset()
    getServerSessionMock.mockResolvedValue(SESSION)
  })

  test("POST /jobs rejects unauthenticated users before creating a job", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs", {
        body: JSON.stringify({ donViId: 17 }),
        method: "POST",
      }),
    )

    expect(response.status).toBe(401)
    expect(createSuggestionJobMock).not.toHaveBeenCalled()
  })

  test("POST /jobs rejects sessions without a role before creating a job", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } })
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs", {
        body: JSON.stringify({ donViId: 17 }),
        method: "POST",
      }),
    )

    expect(response.status).toBe(401)
    expect(createSuggestionJobMock).not.toHaveBeenCalled()
  })

  test("POST /jobs rejects forbidden roles before creating a job", async () => {
    getServerSessionMock.mockResolvedValue(FORBIDDEN_SESSION)
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs", {
        body: JSON.stringify({ donViId: 17 }),
        method: "POST",
      }),
    )

    expect(response.status).toBe(403)
    expect(createSuggestionJobMock).not.toHaveBeenCalled()
  })

  test("POST /jobs sanitizes unexpected auth guard failures", async () => {
    vi.doMock("@/lib/rbac", () => ({
      canAccessDeviceQuotaModule: () => {
        throw new Error("rbac store unavailable")
      },
    }))
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs", {
        body: JSON.stringify({ donViId: 17 }),
        method: "POST",
      }),
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: "Internal server error" })
    expect(createSuggestionJobMock).not.toHaveBeenCalled()
  })

  test("POST /jobs rejects null JSON bodies without throwing", async () => {
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs", {
        body: "null",
        method: "POST",
      }),
    )

    expect(response.status).toBe(400)
    expect(createSuggestionJobMock).not.toHaveBeenCalled()
  })

  test("POST /jobs returns queued job metadata quickly", async () => {
    createSuggestionJobMock.mockResolvedValue({
      id: "job-1",
      status: "queued",
      processedUniqueNames: 0,
      totalUniqueNames: 3,
    })
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs", {
        body: JSON.stringify({ donViId: 17 }),
        method: "POST",
      }),
    )

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toMatchObject({
      job: {
        id: "job-1",
        status: "queued",
        processedUniqueNames: 0,
        totalUniqueNames: 3,
      },
    })
  })

  test("GET /jobs/[jobId] returns job progress for authorized users", async () => {
    getSuggestionJobMock.mockResolvedValue({
      id: "job-1",
      status: "processing",
      processedUniqueNames: 2,
      totalUniqueNames: 3,
    })
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/[jobId]/route")

    const response = await mod.GET(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs/job-1"),
      { params: Promise.resolve({ jobId: "job-1" }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      job: {
        id: "job-1",
        processedUniqueNames: 2,
        status: "processing",
        totalUniqueNames: 3,
      },
    })
  })

  test("GET /jobs/[jobId] rejects forbidden roles before loading a job", async () => {
    getServerSessionMock.mockResolvedValue(FORBIDDEN_SESSION)
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/[jobId]/route")

    const response = await mod.GET(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs/job-1"),
      { params: Promise.resolve({ jobId: "job-1" }) },
    )

    expect(response.status).toBe(403)
    expect(getSuggestionJobMock).not.toHaveBeenCalled()
  })

  test("POST /jobs/[jobId]/retry resets failed chunks", async () => {
    retrySuggestionJobMock.mockResolvedValue({
      id: "job-1",
      status: "queued",
      processedUniqueNames: 1,
      totalUniqueNames: 3,
    })
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/[jobId]/retry/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs/job-1/retry", {
        method: "POST",
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    )

    expect(response.status).toBe(202)
    expect(retrySuggestionJobMock).toHaveBeenCalledWith(expect.objectContaining({ jobId: "job-1" }))
  })

  test("POST /jobs/[jobId]/process rejects unauthenticated users before processing", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/[jobId]/process/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs/job-1/process", {
        body: JSON.stringify({ limit: 2 }),
        method: "POST",
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    )

    expect(response.status).toBe(401)
    expect(processSuggestionJobChunksForJobMock).not.toHaveBeenCalled()
  })

  test("POST /jobs/[jobId]/process rejects forbidden roles before processing", async () => {
    getServerSessionMock.mockResolvedValue(FORBIDDEN_SESSION)
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/[jobId]/process/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs/job-1/process", {
        body: JSON.stringify({ limit: 2 }),
        method: "POST",
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    )

    expect(response.status).toBe(403)
    expect(processSuggestionJobChunksForJobMock).not.toHaveBeenCalled()
  })

  test("POST /jobs/[jobId]/process clamps bounded work and returns 202 while processing", async () => {
    processSuggestionJobChunksForJobMock.mockResolvedValue({
      failed: 0,
      job: {
        id: "job-1",
        processedUniqueNames: 2,
        status: "processing",
        totalUniqueNames: 5,
      },
      processed: 2,
    })
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/[jobId]/process/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs/job-1/process", {
        body: JSON.stringify({ limit: 99 }),
        method: "POST",
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    )

    expect(response.status).toBe(202)
    expect(processSuggestionJobChunksForJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", limit: 5 }),
    )
    await expect(response.json()).resolves.toMatchObject({
      failed: 0,
      job: { id: "job-1", status: "processing" },
      processed: 2,
      requestId: expect.any(String),
    })
  })

  test("POST /jobs/[jobId]/process returns 200 when processing completes the job", async () => {
    processSuggestionJobChunksForJobMock.mockResolvedValue({
      failed: 0,
      job: {
        id: "job-1",
        processedUniqueNames: 5,
        status: "succeeded",
        totalUniqueNames: 5,
      },
      processed: 1,
    })
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/[jobId]/process/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs/job-1/process", {
        method: "POST",
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      job: { id: "job-1", status: "succeeded" },
      processed: 1,
    })
  })

  test("POST /jobs/[jobId]/retry rejects forbidden roles before retrying a job", async () => {
    getServerSessionMock.mockResolvedValue(FORBIDDEN_SESSION)
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/[jobId]/retry/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs/job-1/retry", {
        method: "POST",
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    )

    expect(response.status).toBe(403)
    expect(retrySuggestionJobMock).not.toHaveBeenCalled()
  })

  test("POST /jobs/[jobId]/retry logs unexpected failures before returning sanitized errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    retrySuggestionJobMock.mockRejectedValue(new Error("database unavailable"))
    const mod = await import("@/app/api/device-quota/mapping/suggest/jobs/[jobId]/retry/route")

    const response = await mod.POST(
      new Request("https://example.test/api/device-quota/mapping/suggest/jobs/job-1/retry", {
        method: "POST",
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: "Internal server error" })
    expect(errorSpy).toHaveBeenCalledWith("Suggestion job retry failed", expect.any(Error))
    errorSpy.mockRestore()
  })
})
