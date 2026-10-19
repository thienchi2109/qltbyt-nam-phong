import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const mocks = vi.hoisted(() => ({ session: vi.fn(), prepare: vi.fn(), rpc: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("next-auth", () => ({ getServerSession: mocks.session }))
vi.mock("@/auth/config", () => ({ authOptions: {} }))
vi.mock("@/lib/temperature-monitoring-export", () => ({ prepareTemperatureExport: mocks.prepare }))
vi.mock("@/lib/ai/server-rpc", () => ({ callServerRpc: mocks.rpc }))
import { POST } from "../route"

let actor = 100
const directories: string[] = []
function request(
  body: unknown = { from: "2024-01-01", to: "2024-12-31" },
  origin = "https://app.example"
) {
  return new Request("https://app.example/api/temperature-monitoring/export", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}
beforeEach(() => {
  mocks.session.mockResolvedValue({
    user: { id: String(++actor), role: "user", don_vi: 7, dia_ban_id: 1, khoa_phong: "Lab" },
  })
  mocks.prepare.mockReset()
  mocks.rpc.mockReset()
})
afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe("temperature export route", () => {
  it("rejects unauthenticated, cross-origin, cross-year and hostile body input before generation", async () => {
    expect((await POST(request({}, "https://evil.example"))).status).toBe(403)
    mocks.session.mockResolvedValueOnce(null)
    expect((await POST(request())).status).toBe(401)
    for (const body of [
      { from: "2024-12-31", to: "2025-01-01" },
      { from: "0000-01-01", to: "0000-12-31" },
      { from: "2024-01-01", to: "2024-12-31", status: "Chưa ghi" },
      { from: "2024-01-01", to: "2024-12-31", don_vi: 99 },
    ])
      expect((await POST(request(body))).status).toBe(400)
    expect((await POST(request({ padding: "x".repeat(5000) }))).status).toBe(413)
    expect(mocks.prepare).not.toHaveBeenCalled()
  })

  it("passes >90-day same-year filters and session claims, then delivers only completed bytes", async () => {
    mocks.session.mockResolvedValue({
      user: { id: String(actor), role: "admin", don_vi: null, dia_ban_id: 1, khoa_phong: "Lab" },
    })
    const directory = await mkdtemp(join(tmpdir(), "tm09-route-test-"))
    directories.push(directory)
    const path = join(directory, "file.xlsx")
    await writeFile(path, "PKcomplete")
    const cleanup = vi.fn(async () => {
      await rm(path, { force: true })
    })
    mocks.prepare.mockImplementationOnce(async (_filter, _actor, load) => {
      await load({ p_dataset: "readings" })
      return { path, bytes: 10, cleanup }
    })
    const response = await POST(request())
    expect(mocks.prepare.mock.calls[0][0]).toEqual({ from: "2024-01-01", to: "2024-12-31" })
    expect(mocks.rpc).toHaveBeenCalledWith(
      "temperature_monitoring_export_page",
      { p_dataset: "readings" },
      expect.objectContaining({ id: String(actor), role: "admin" }),
      expect.objectContaining({ maxResponseBytes: 1024 * 1024 })
    )
    expect(response.headers.get("content-disposition")).toContain(".xlsx")
    expect(await response.text()).toBe("PKcomplete")
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledOnce())
    await cleanup.mock.results[0].value
    await expect(readFile(path)).rejects.toThrow()
  })

  it("never exposes raw database errors or attachment headers and releases failed work", async () => {
    mocks.prepare.mockRejectedValue(new Error("secret SQL password SELECT private"))
    const first = await POST(request())
    expect(first.status).toBe(500)
    expect(first.headers.get("content-disposition")).toBeNull()
    expect(await first.text()).not.toContain("secret SQL")
    expect((await POST(request())).status).toBe(500)
    expect(mocks.prepare).toHaveBeenCalledTimes(2)
  })

  it("rejects duplicate active requests and releases the slot after preparation failure", async () => {
    let reject!: (reason: Error) => void
    mocks.prepare.mockImplementationOnce(
      () =>
        new Promise((_resolve, failure) => {
          reject = failure
        })
    )
    const first = POST(request())
    await vi.waitFor(() => expect(mocks.prepare).toHaveBeenCalledOnce())
    expect((await POST(request())).status).toBe(429)
    reject(new Error("failed"))
    expect((await first).status).toBe(500)
  })

  it("aborts preparation at the 60-second ceiling before any attachment headers", async () => {
    vi.useFakeTimers()
    mocks.prepare.mockImplementationOnce(
      (_filter, _actor, _load, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true })
        })
    )
    const pending = POST(request())
    await vi.waitFor(() => expect(mocks.prepare).toHaveBeenCalledOnce())
    await vi.advanceTimersByTimeAsync(60_000)
    const response = await pending
    expect(response.status).toBe(500)
    expect(response.headers.get("content-disposition")).toBeNull()
    expect((mocks.prepare.mock.calls[0][3] as AbortSignal).aborted).toBe(true)
  })
})
