import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationWorkspaceShell } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab",
  () => ({
    TechnicalConfigurationBaselineTab: ({
      isFocusMode,
      onDirtyChange,
      onNavigationBlockedChange,
      onToggleFocusMode,
    }: {
      isFocusMode: boolean
      onDirtyChange: (dirty: boolean) => void
      onNavigationBlockedChange?: (blocked: boolean) => void
      onToggleFocusMode: () => void
    }) => {
      const [isDialogOpen, setIsDialogOpen] = React.useState(false)

      React.useEffect(() => {
        onDirtyChange(false)
        onNavigationBlockedChange?.(false)
      }, [onDirtyChange, onNavigationBlockedChange])

      return (
        <div>
          <label>
            Nội dung bản nháp
            <input defaultValue="Nguồn điện ổn định" />
          </label>
          <div role="region" aria-label="Các nhóm cấu hình cơ sở" tabIndex={0}>
            Danh sách tiêu chí
          </div>
          <span>{isFocusMode ? "Đang tập trung chỉnh sửa" : "Bố cục mặc định"}</span>
          <button type="button" onClick={onToggleFocusMode}>
            {isFocusMode ? "Thu nhỏ vùng chỉnh sửa" : "Mở rộng vùng chỉnh sửa"}
          </button>
          <button type="button" onClick={() => setIsDialogOpen(true)}>
            Mở hộp thoại
          </button>
          {isDialogOpen ? (
            <div role="dialog" aria-label="Hộp thoại kiểm thử">
              <button type="button">Thao tác hộp thoại</button>
              <button type="button" onClick={() => setIsDialogOpen(false)}>
                Đóng hộp thoại
              </button>
            </div>
          ) : null}
        </div>
      )
    },
  })
)

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEvidence",
  () => ({
    TechnicalConfigurationBaselineEvidence: () => <div>Tài liệu kiểm thử</div>,
  })
)

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProducts",
  () => ({
    TechnicalConfigurationReferenceProducts: () => <div>Sản phẩm tham chiếu kiểm thử</div>,
  })
)

vi.mock("@/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers", () => ({
  TechnicalConfigurationSuppliers: () => <div>Phương án kiểm thử</div>,
}))

vi.mock(
  "@/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationComparisonTab",
  () => ({
    TechnicalConfigurationComparisonTab: () => <div>So sánh kiểm thử</div>,
  })
)

const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy lọc thận",
  name: "Cấu hình máy lọc thận",
  description: "Hồ sơ kiểm thử",
  revision: 3,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
}

describe("technical configuration workspace focus mode", () => {
  it("expands the editor without remounting its draft or scroll region", async () => {
    const user = userEvent.setup()
    render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={vi.fn()} />)

    const workspace = screen.getByTestId("technical-configuration-workspace")
    const draftInput = screen.getByLabelText("Nội dung bản nháp")
    const scrollRegion = screen.getByRole("region", { name: "Các nhóm cấu hình cơ sở" })
    scrollRegion.scrollTop = 137

    await user.type(draftInput, " đã sửa")
    await user.click(screen.getByRole("button", { name: "Mở rộng vùng chỉnh sửa" }))

    expect(workspace).toHaveClass("overflow-hidden")
    expect(screen.queryByRole("heading", { name: dossier.name })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(screen.getByText("Đang tập trung chỉnh sửa")).toBeInTheDocument()
    expect(screen.getByLabelText("Nội dung bản nháp")).toBe(draftInput)
    expect(draftInput).toHaveValue("Nguồn điện ổn định đã sửa")
    expect(screen.getByRole("region", { name: "Các nhóm cấu hình cơ sở" })).toBe(scrollRegion)
    expect(scrollRegion.scrollTop).toBe(137)

    await user.click(screen.getByRole("button", { name: "Thu nhỏ vùng chỉnh sửa" }))

    expect(screen.getByRole("heading", { name: dossier.name })).toBeInTheDocument()
    expect(screen.getAllByRole("tab")).toHaveLength(5)
    expect(screen.getByLabelText("Nội dung bản nháp")).toBe(draftInput)
  })

  it("uses guarded Escape behavior and resets focus mode for another dossier", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={vi.fn()} />
    )

    await user.click(screen.getByRole("button", { name: "Mở rộng vùng chỉnh sửa" }))
    const draftInput = screen.getByLabelText("Nội dung bản nháp")
    await user.click(draftInput)
    await user.keyboard("{Escape}")
    expect(screen.getByText("Đang tập trung chỉnh sửa")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Mở hộp thoại" }))
    await user.click(screen.getByRole("button", { name: "Thao tác hộp thoại" }))
    await user.keyboard("{Escape}")
    expect(screen.getByText("Đang tập trung chỉnh sửa")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Đóng hộp thoại" }))
    await user.click(screen.getByText("Đang tập trung chỉnh sửa"))
    await user.keyboard("{Escape}")
    expect(screen.getByText("Bố cục mặc định")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Mở rộng vùng chỉnh sửa" }))
    rerender(
      <TechnicalConfigurationWorkspaceShell
        dossier={{ ...dossier, id: "dossier-2", name: "Cấu hình máy thở" }}
        onBack={vi.fn()}
      />
    )

    expect(await screen.findByText("Bố cục mặc định")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Cấu hình máy thở" })).toBeInTheDocument()
  })
})
