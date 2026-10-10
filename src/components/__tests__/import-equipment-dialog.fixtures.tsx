/**
 * Tests for ImportEquipmentDialog component
 *
 * Validates:
 * 1. Component rendering and dialog structure
 * 2. File input handling and validation
 * 3. Error display (parse errors, validation errors)
 * 4. Date rejection warning display
 * 5. Success message display
 * 6. Submit button states
 * 7. Dialog open/close behavior
 * 8. Integration with useBulkImportState hook
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import * as React from "react"

// Mock external dependencies
const mockToast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

const mockCallRpc = vi.fn()
vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

const mockNormalizeDateForImport = vi.fn((val) => ({
  value: `generic:${String(val)}`,
  rejected: false,
}))
const mockNormalizeFullDateForImport = vi.fn((val) => ({
  value: `full:${String(val)}`,
  rejected: false,
}))
vi.mock("@/lib/date-utils", () => ({
  normalizeDateForImport: (...args: unknown[]) => mockNormalizeDateForImport(...args),
  normalizeFullDateForImport: (...args: unknown[]) => mockNormalizeFullDateForImport(...args),
  FULL_DATE_ERROR_MESSAGE: "Ngay ngung su dung khong hop le",
}))

// Mock dialog components for simpler testing
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({
    children,
    onCloseAutoFocus,
  }: {
    children: React.ReactNode
    onCloseAutoFocus?: () => void
    onInteractOutside?: (e: Event) => void
  }) => (
    <div data-testid="dialog-content" onBlur={onCloseAutoFocus}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}))

// Mock bulk import components with functional implementations
vi.mock("@/components/bulk-import", () => ({
  useBulkImportState: vi.fn(),
  BulkImportFileInput: ({
    id,
    fileInputRef,
    onFileChange,
    disabled,
    accept,
    label,
  }: {
    id: string
    fileInputRef: React.RefObject<HTMLInputElement>
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    disabled?: boolean
    accept?: string
    label?: string
  }) => (
    <div data-testid="bulk-import-file-input">
      <label htmlFor={id}>{label || "Chon file"}</label>
      <input
        id={id}
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        disabled={disabled}
        accept={accept}
        data-testid="file-input"
      />
    </div>
  ),
  BulkImportErrorAlert: ({ error }: { error: string | null }) =>
    error ? (
      <div data-testid="error-alert" role="alert">
        {error}
      </div>
    ) : null,
  BulkImportValidationErrors: ({ errors }: { errors: string[] }) =>
    errors.length > 0 ? (
      <div data-testid="validation-errors">
        <span>Du lieu khong hop le:</span>
        <ul>
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      </div>
    ) : null,
  BulkImportSuccessMessage: ({
    fileName,
    recordCount,
  }: {
    fileName: string
    recordCount: number
  }) => (
    <output data-testid="success-message" aria-live="polite">
      <span>{fileName}</span>
      <span data-testid="record-count">{recordCount}</span>
    </output>
  ),
  BulkImportSubmitButton: ({
    isSubmitting,
    disabled,
    recordCount,
    onClick,
  }: {
    isSubmitting: boolean
    disabled: boolean
    recordCount: number
    labelSingular?: string
    labelPlural?: string
    onClick: () => void
  }) => (
    <button
      data-testid="submit-button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={isSubmitting}
    >
      {isSubmitting ? "Dang nhap..." : `Nhap ${recordCount} thiet bi`}
    </button>
  ),
  buildImportToastMessage: vi.fn(() => ({
    variant: "default",
    title: "Thanh cong",
    description: "Da nhap du lieu",
    duration: 5000,
  })),
}))

// Import after mocks
import { useBulkImportState } from "@/components/bulk-import"
import type { Equipment } from "@/lib/data"

const mockUseBulkImportState = useBulkImportState as Mock

const createMockFile = (name: string = "equipment.xlsx") => {
  return new File([""], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

// Sample parsed equipment data
const createMockEquipment = (overrides: Partial<Equipment> = {}): Partial<Equipment> => ({
  ma_thiet_bi: "EQ001",
  ten_thiet_bi: "May sieu am",
  khoa_phong_quan_ly: "Khoa Noi",
  nguoi_dang_truc_tiep_quan_ly: "Nguyen Van A",
  tinh_trang_hien_tai: "Hoạt động",
  vi_tri_lap_dat: "Phong 101",
  ...overrides,
})

// Helper to set up mock hook state
const setupMockHookState = (
  overrides: Partial<{
    status: "idle" | "parsing" | "parsed" | "submitting" | "success" | "error"
    selectedFile: File | null
    parsedData: Partial<Equipment>[]
    parseError: string | null
    validationErrors: string[]
  }> = {}
) => {
  const defaultState = {
    status: "idle" as const,
    selectedFile: null,
    parsedData: [],
    parseError: null,
    validationErrors: [],
    ...overrides,
  }

  const mockResetState = vi.fn()
  const mockSetSubmitting = vi.fn()
  const mockSetSuccess = vi.fn()
  const mockSetSubmitError = vi.fn()
  const mockHandleFileChange = vi.fn()
  const mockFileInputRef = { current: null }

  mockUseBulkImportState.mockReturnValue({
    state: defaultState,
    fileInputRef: mockFileInputRef,
    handleFileChange: mockHandleFileChange,
    resetState: mockResetState,
    setSubmitting: mockSetSubmitting,
    setSuccess: mockSetSuccess,
    setSubmitError: mockSetSubmitError,
  })

  return {
    state: defaultState,
    mockResetState,
    mockSetSubmitting,
    mockSetSuccess,
    mockSetSubmitError,
    mockHandleFileChange,
    mockFileInputRef,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setupMockHookState()
})

vi.mock("@/hooks/use-equipment-status-catalog", async () => {
  const { readyStatusCatalog } = await import("@/hooks/__tests__/equipment-status-catalog-fixtures")
  return { useEquipmentStatusCatalog: () => readyStatusCatalog }
})

export {
  setupMockHookState,
  createMockEquipment,
  createMockFile,
  mockUseBulkImportState,
  mockCallRpc,
  mockToast,
  mockNormalizeDateForImport,
  mockNormalizeFullDateForImport,
}
