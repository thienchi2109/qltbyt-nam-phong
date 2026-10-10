import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import * as React from "react"
import {
  setupMockHookState,
  createMockEquipment,
  createMockFile,
} from "./import-equipment-dialog.fixtures"
import { ImportEquipmentDialog } from "../import-equipment-dialog"

describe("Error Display", () => {
  it("should display parse error when present", () => {
    setupMockHookState({
      status: "error",
      parseError: "File khong hop le",
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("error-alert")).toBeInTheDocument()
    expect(screen.getByText("File khong hop le")).toBeInTheDocument()
  })

  it("should display validation errors when present", () => {
    setupMockHookState({
      status: "error",
      validationErrors: ["Dong 2: Thieu Khoa/phong quan ly", "Dong 3: Tinh trang khong hop le"],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("validation-errors")).toBeInTheDocument()
    expect(screen.getByText("Dong 2: Thieu Khoa/phong quan ly")).toBeInTheDocument()
    expect(screen.getByText("Dong 3: Tinh trang khong hop le")).toBeInTheDocument()
  })

  it("should not display error alert when no parse error", () => {
    setupMockHookState({ parseError: null })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.queryByTestId("error-alert")).not.toBeInTheDocument()
  })

  it("should not display validation errors when empty", () => {
    setupMockHookState({ validationErrors: [] })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.queryByTestId("validation-errors")).not.toBeInTheDocument()
  })
})

describe("Success Message", () => {
  it("should display success message when file parsed successfully", () => {
    const mockFile = createMockFile("equipment-list.xlsx")
    setupMockHookState({
      status: "parsed",
      selectedFile: mockFile,
      parsedData: [createMockEquipment(), createMockEquipment({ ma_thiet_bi: "EQ002" })],
      parseError: null,
      validationErrors: [],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("success-message")).toBeInTheDocument()
    expect(screen.getByText("equipment-list.xlsx")).toBeInTheDocument()
    expect(screen.getByTestId("record-count")).toHaveTextContent("2")
  })

  it("should not display success message when no file selected", () => {
    setupMockHookState({ selectedFile: null, parsedData: [] })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.queryByTestId("success-message")).not.toBeInTheDocument()
  })

  it("should not display success message when parse error exists", () => {
    const mockFile = createMockFile()
    setupMockHookState({
      selectedFile: mockFile,
      parsedData: [],
      parseError: "Error reading file",
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.queryByTestId("success-message")).not.toBeInTheDocument()
  })

  it("should not display success message when validation errors exist", () => {
    const mockFile = createMockFile()
    setupMockHookState({
      selectedFile: mockFile,
      parsedData: [createMockEquipment()],
      validationErrors: ["Dong 2: Error"],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.queryByTestId("success-message")).not.toBeInTheDocument()
  })
})

describe("Submit Button States", () => {
  it("should disable submit button when no file selected", () => {
    setupMockHookState({ selectedFile: null })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("submit-button")).toBeDisabled()
  })

  it("should disable submit button when parse error exists", () => {
    setupMockHookState({
      selectedFile: createMockFile(),
      parseError: "Error",
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("submit-button")).toBeDisabled()
  })

  it("should disable submit button when no parsed data", () => {
    setupMockHookState({
      selectedFile: createMockFile(),
      parsedData: [],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("submit-button")).toBeDisabled()
  })

  it("should disable submit button when validation errors exist", () => {
    setupMockHookState({
      selectedFile: createMockFile(),
      parsedData: [createMockEquipment()],
      validationErrors: ["Error"],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("submit-button")).toBeDisabled()
  })

  it("should disable submit button when submitting", () => {
    setupMockHookState({
      status: "submitting",
      selectedFile: createMockFile(),
      parsedData: [createMockEquipment()],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("submit-button")).toBeDisabled()
  })

  it("should enable submit button when data is valid", () => {
    setupMockHookState({
      status: "parsed",
      selectedFile: createMockFile(),
      parsedData: [createMockEquipment()],
      parseError: null,
      validationErrors: [],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByTestId("submit-button")).not.toBeDisabled()
  })

  it("should show loading text when submitting", () => {
    setupMockHookState({
      status: "submitting",
      selectedFile: createMockFile(),
      parsedData: [createMockEquipment()],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByText("Dang nhap...")).toBeInTheDocument()
  })

  it("should show record count in submit button", () => {
    setupMockHookState({
      status: "parsed",
      selectedFile: createMockFile(),
      parsedData: [
        createMockEquipment(),
        createMockEquipment({ ma_thiet_bi: "EQ002" }),
        createMockEquipment({ ma_thiet_bi: "EQ003" }),
      ],
      parseError: null,
      validationErrors: [],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByText("Nhap 3 thiet bi")).toBeInTheDocument()
  })
})
