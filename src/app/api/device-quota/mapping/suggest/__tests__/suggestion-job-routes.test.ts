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
const retrySuggestionJobMock = vi.fn()
vi.mock("@/app/api/device-quota/mapping/suggest/suggestion-job-service", () => ({
  createSuggestionJob: (...args: unknown[]) => createSuggestionJobMock(...args),
  getSuggestionJob: (...args: unknown[]) => getSuggestionJobMock(...args),
  retrySuggestionJob: (...args: unknown[]) => retrySuggestionJobMock(...args),
}))

const SESSION = {
  user: {
    id: "user-1",
    role: "to_qltb",
    don_vi: "17",
  },
}

describe("device quota suggestion job routes", () => {
  beforeEach(() => {
    vi.resetModules()
    getServerSessionMock.mockReset()
    createSuggestionJobMock.mockReset()
    getSuggestionJobMock.mockReset()
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
})
