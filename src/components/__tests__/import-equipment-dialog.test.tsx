import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import * as React from "react"
import { setupMockHookState, createMockFile } from "./import-equipment-dialog.fixtures"
import { ImportEquipmentDialog } from "../import-equipment-dialog"

describe("Rendering", () => {
  it("should not render when closed", () => {
    render(<ImportEquipmentDialog open={false} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument()
  })

  it("should render dialog when open", () => {
    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("dialog")).toBeInTheDocument()
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument()
  })

  it("should render dialog title", () => {
    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("dialog-title")).toHaveTextContent(/Nhập thiết bị từ file Excel/i)
  })

  it("should render dialog description", () => {
    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("dialog-description")).toHaveTextContent(
      /Chọn file Excel.*để nhập hàng loạt/i
    )
  })

  it("should render file input", () => {
    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("bulk-import-file-input")).toBeInTheDocument()
    expect(screen.getByTestId("file-input")).toBeInTheDocument()
  })

  it("should render cancel button", () => {
    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByRole("button", { name: /Hủy/i })).toBeInTheDocument()
  })

  it("should render submit button", () => {
    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("submit-button")).toBeInTheDocument()
  })

  it("should accept xlsx, xls, and csv file extensions", () => {
    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    const fileInput = screen.getByTestId("file-input")
    expect(fileInput).toHaveAttribute("accept", ".xlsx, .xls, .csv")
  })
})

describe("File Input Handling", () => {
  it("should call handleFileChange when file is selected", () => {
    const { mockHandleFileChange } = setupMockHookState()

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    const fileInput = screen.getByTestId("file-input")
    const mockFile = createMockFile()

    fireEvent.change(fileInput, { target: { files: [mockFile] } })

    // The component wraps handleFileChange, so we check if it was invoked
    expect(mockHandleFileChange).toHaveBeenCalled()
  })

  it("should disable file input when submitting", () => {
    setupMockHookState({ status: "submitting" })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    const fileInput = screen.getByTestId("file-input")
    expect(fileInput).toBeDisabled()
  })
})
