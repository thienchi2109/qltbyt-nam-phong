import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TemperatureMonitoringFilters } from "../TemperatureMonitoringFilters"
import type { useTemperatureLogbook } from "@/hooks/use-temperature-logbook"

describe("temperature annual export controls", () => {
  it("keeps export dates independent and visibly rejects a cross-year request", () => {
    const setRange = vi.fn()
    const workspace = {
      tab: "history",
      range: { from: "2024-01-01", to: "2024-12-31" },
      setRange,
      historyFilters: [],
      query: { data: { shift_choices: [] } },
      shift: "",
      slot: null,
      workspaceArgs: { p_equipment_id: 7 },
    } as unknown as ReturnType<typeof useTemperatureLogbook>
    render(<TemperatureMonitoringFilters w={workspace} />)
    expect(screen.getByText(/Xem trên màn hình: tối đa 90 ngày/)).toBeInTheDocument()
    expect(screen.getByText(/Không gồm ca chưa ghi\/quá hạn/)).toBeInTheDocument()
    const download = screen.getByRole("button", { name: "Xuất Excel" })
    expect(download).toBeEnabled()
    fireEvent.change(screen.getByLabelText("Xuất đến"), { target: { value: "2025-01-01" } })
    expect(download).toBeDisabled()
    expect(screen.getByRole("status")).toHaveTextContent("cùng một năm")
    expect(setRange).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText("Xuất đến"), { target: { value: "2024-12-31" } })
    expect(download).toBeEnabled()
  })
})
