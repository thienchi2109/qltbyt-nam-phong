import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useTemperatureExport } from "@/hooks/use-temperature-export"

afterEach(() => vi.unstubAllGlobals())
describe("temperature binary export", () => {
  it("keeps independent export dates and rejects crossing a calendar year without fetching", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { result } = renderHook(() =>
      useTemperatureExport({ from: "2024-01-01", to: "2024-12-31" })
    )
    expect(result.current.valid).toBe(true)
    act(() => result.current.setRange({ from: "2024-12-31", to: "2025-01-01" }))
    await act(() => result.current.download(7, "dem"))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.message).toContain("cùng một năm")
  })

  it("sends a full-year request but never saves a partial binary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("PK", {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-length": "10",
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    const createObjectURL = vi.fn()
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL }))
    const { result } = renderHook(() =>
      useTemperatureExport({ from: "2024-01-01", to: "2024-12-31" })
    )
    await act(() => result.current.download(7, "dem"))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      from: "2024-01-01",
      to: "2024-12-31",
      equipment: 7,
      shift: "dem",
    })
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(result.current.message).toContain("chưa hoàn tất")
    expect(result.current.phase).toBe("idle")
  })
})
