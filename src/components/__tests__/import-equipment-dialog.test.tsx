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

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import * as React from 'react'

// Mock external dependencies
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

const mockCallRpc = vi.fn()
vi.mock('@/lib/rpc-client', () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

vi.mock('@/lib/date-utils', () => ({
  normalizeDateForImport: vi.fn((val) => ({ value: val, rejected: false })),
}))

vi.mock('@/components/equipment/equipment-table-columns', () => ({
  equipmentStatusOptions: [
    'Hoat dong',
    'Cho sua chua',
    'Cho bao tri',
    'Cho hieu chuan/kiem dinh',
    'Ngung su dung',
    'Chua co nhu cau su dung',
  ],
}))

// Mock dialog components for simpler testing
vi.mock('@/components/ui/dialog', () => ({
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
vi.mock('@/components/bulk-import', () => ({
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
      <label htmlFor={id}>{label || 'Chon file'}</label>
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
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
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
    <div data-testid="success-message" role="status" aria-live="polite">
      <span>{fileName}</span>
      <span data-testid="record-count">{recordCount}</span>
    </div>
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
      {isSubmitting ? 'Dang nhap...' : `Nhap ${recordCount} thiet bi`}
    </button>
  ),
  buildImportToastMessage: vi.fn(() => ({
    variant: 'default',
    title: 'Thanh cong',
    description: 'Da nhap du lieu',
    duration: 5000,
  })),
}))

// Import after mocks
import { ImportEquipmentDialog } from '../import-equipment-dialog'
import { useBulkImportState } from '@/components/bulk-import'
import type { Equipment } from '@/lib/data'

const mockUseBulkImportState = useBulkImportState as Mock

const createMockFile = (name: string = 'equipment.xlsx') => {
  return new File([''], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// Sample parsed equipment data
const createMockEquipment = (overrides: Partial<Equipment> = {}): Partial<Equipment> => ({
  ma_thiet_bi: 'EQ001',
  ten_thiet_bi: 'May sieu am',
  khoa_phong_quan_ly: 'Khoa Noi',
  nguoi_dang_truc_tiep_quan_ly: 'Nguyen Van A',
  tinh_trang_hien_tai: 'Hoat dong',
  vi_tri_lap_dat: 'Phong 101',
  ...overrides,
})

// Helper to set up mock hook state
const setupMockHookState = (overrides: Partial<{
  status: 'idle' | 'parsing' | 'parsed' | 'submitting' | 'success' | 'error'
  selectedFile: File | null
  parsedData: Partial<Equipment>[]
  parseError: string | null
  validationErrors: string[]
}> = {}) => {
  const defaultState = {
    status: 'idle' as const,
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

describe('ImportEquipmentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockHookState()
  })

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(
        <ImportEquipmentDialog
          open={false}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })

    it('should render dialog when open', () => {
      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument()
    })

    it('should render dialog title', () => {
      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(/Nhập thiết bị từ file Excel/i)
    })

    it('should render dialog description', () => {
      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('dialog-description')).toHaveTextContent(/Chọn file Excel.*để nhập hàng loạt/i)
    })

    it('should render file input', () => {
      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('bulk-import-file-input')).toBeInTheDocument()
      expect(screen.getByTestId('file-input')).toBeInTheDocument()
    })

    it('should render cancel button', () => {
      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByRole('button', { name: /Hủy/i })).toBeInTheDocument()
    })

    it('should render submit button', () => {
      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('submit-button')).toBeInTheDocument()
    })

    it('should accept xlsx, xls, and csv file extensions', () => {
      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      const fileInput = screen.getByTestId('file-input')
      expect(fileInput).toHaveAttribute('accept', '.xlsx, .xls, .csv')
    })
  })

  describe('File Input Handling', () => {
    it('should call handleFileChange when file is selected', () => {
      const { mockHandleFileChange } = setupMockHookState()

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      const fileInput = screen.getByTestId('file-input')
      const mockFile = createMockFile()

      fireEvent.change(fileInput, { target: { files: [mockFile] } })

      // The component wraps handleFileChange, so we check if it was invoked
      expect(mockHandleFileChange).toHaveBeenCalled()
    })

    it('should disable file input when submitting', () => {
      setupMockHookState({ status: 'submitting' })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      const fileInput = screen.getByTestId('file-input')
      expect(fileInput).toBeDisabled()
    })
  })

  describe('Error Display', () => {
    it('should display parse error when present', () => {
      setupMockHookState({
        status: 'error',
        parseError: 'File khong hop le',
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('error-alert')).toBeInTheDocument()
      expect(screen.getByText('File khong hop le')).toBeInTheDocument()
    })

    it('should display validation errors when present', () => {
      setupMockHookState({
        status: 'error',
        validationErrors: [
          'Dong 2: Thieu Khoa/phong quan ly',
          'Dong 3: Tinh trang khong hop le',
        ],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('validation-errors')).toBeInTheDocument()
      expect(screen.getByText('Dong 2: Thieu Khoa/phong quan ly')).toBeInTheDocument()
      expect(screen.getByText('Dong 3: Tinh trang khong hop le')).toBeInTheDocument()
    })

    it('should not display error alert when no parse error', () => {
      setupMockHookState({ parseError: null })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument()
    })

    it('should not display validation errors when empty', () => {
      setupMockHookState({ validationErrors: [] })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.queryByTestId('validation-errors')).not.toBeInTheDocument()
    })
  })

  describe('Success Message', () => {
    it('should display success message when file parsed successfully', () => {
      const mockFile = createMockFile('equipment-list.xlsx')
      setupMockHookState({
        status: 'parsed',
        selectedFile: mockFile,
        parsedData: [createMockEquipment(), createMockEquipment({ ma_thiet_bi: 'EQ002' })],
        parseError: null,
        validationErrors: [],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('success-message')).toBeInTheDocument()
      expect(screen.getByText('equipment-list.xlsx')).toBeInTheDocument()
      expect(screen.getByTestId('record-count')).toHaveTextContent('2')
    })

    it('should not display success message when no file selected', () => {
      setupMockHookState({ selectedFile: null, parsedData: [] })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.queryByTestId('success-message')).not.toBeInTheDocument()
    })

    it('should not display success message when parse error exists', () => {
      const mockFile = createMockFile()
      setupMockHookState({
        selectedFile: mockFile,
        parsedData: [],
        parseError: 'Error reading file',
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.queryByTestId('success-message')).not.toBeInTheDocument()
    })

    it('should not display success message when validation errors exist', () => {
      const mockFile = createMockFile()
      setupMockHookState({
        selectedFile: mockFile,
        parsedData: [createMockEquipment()],
        validationErrors: ['Dong 2: Error'],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.queryByTestId('success-message')).not.toBeInTheDocument()
    })
  })

  describe('Submit Button States', () => {
    it('should disable submit button when no file selected', () => {
      setupMockHookState({ selectedFile: null })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('submit-button')).toBeDisabled()
    })

    it('should disable submit button when parse error exists', () => {
      setupMockHookState({
        selectedFile: createMockFile(),
        parseError: 'Error',
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('submit-button')).toBeDisabled()
    })

    it('should disable submit button when no parsed data', () => {
      setupMockHookState({
        selectedFile: createMockFile(),
        parsedData: [],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('submit-button')).toBeDisabled()
    })

    it('should disable submit button when validation errors exist', () => {
      setupMockHookState({
        selectedFile: createMockFile(),
        parsedData: [createMockEquipment()],
        validationErrors: ['Error'],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('submit-button')).toBeDisabled()
    })

    it('should disable submit button when submitting', () => {
      setupMockHookState({
        status: 'submitting',
        selectedFile: createMockFile(),
        parsedData: [createMockEquipment()],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('submit-button')).toBeDisabled()
    })

    it('should enable submit button when data is valid', () => {
      setupMockHookState({
        status: 'parsed',
        selectedFile: createMockFile(),
        parsedData: [createMockEquipment()],
        parseError: null,
        validationErrors: [],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByTestId('submit-button')).not.toBeDisabled()
    })

    it('should show loading text when submitting', () => {
      setupMockHookState({
        status: 'submitting',
        selectedFile: createMockFile(),
        parsedData: [createMockEquipment()],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByText('Dang nhap...')).toBeInTheDocument()
    })

    it('should show record count in submit button', () => {
      setupMockHookState({
        status: 'parsed',
        selectedFile: createMockFile(),
        parsedData: [
          createMockEquipment(),
          createMockEquipment({ ma_thiet_bi: 'EQ002' }),
          createMockEquipment({ ma_thiet_bi: 'EQ003' }),
        ],
        parseError: null,
        validationErrors: [],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByText('Nhap 3 thiet bi')).toBeInTheDocument()
    })
  })

  describe('Dialog Open/Close Behavior', () => {
    it('should call onOpenChange when cancel button clicked', () => {
      const { mockResetState } = setupMockHookState()
      const onOpenChange = vi.fn()

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={onOpenChange}
          onSuccess={() => {}}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Hủy/i }))

      expect(mockResetState).toHaveBeenCalled()
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('should disable cancel button when submitting', () => {
      setupMockHookState({ status: 'submitting' })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByRole('button', { name: /Hủy/i })).toBeDisabled()
    })
  })

  describe('Import Submission', () => {
    it('should call RPC with correct arguments on submit', async () => {
      const mockEquipment = createMockEquipment()
      const { mockSetSubmitting, mockSetSuccess } = setupMockHookState({
        status: 'parsed',
        selectedFile: createMockFile(),
        parsedData: [mockEquipment],
        parseError: null,
        validationErrors: [],
      })

      mockCallRpc.mockResolvedValue({
        success: true,
        inserted: 1,
        failed: 0,
        total: 1,
        details: [],
      })

      const onSuccess = vi.fn()

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={onSuccess}
        />
      )

      fireEvent.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockSetSubmitting).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledWith({
          fn: 'equipment_bulk_import',
          args: {
            p_items: expect.arrayContaining([
              expect.objectContaining({
                ma_thiet_bi: 'EQ001',
                ten_thiet_bi: 'May sieu am',
              }),
            ]),
          },
        })
      })

      await waitFor(() => {
        expect(mockSetSuccess).toHaveBeenCalled()
        expect(onSuccess).toHaveBeenCalled()
      })
    })

    it('should show toast on successful import', async () => {
      setupMockHookState({
        status: 'parsed',
        selectedFile: createMockFile(),
        parsedData: [createMockEquipment()],
        parseError: null,
        validationErrors: [],
      })

      mockCallRpc.mockResolvedValue({
        success: true,
        inserted: 1,
        failed: 0,
        total: 1,
        details: [],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      fireEvent.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled()
      })
    })

    it('should show error toast on RPC failure', async () => {
      const { mockSetSubmitError } = setupMockHookState({
        status: 'parsed',
        selectedFile: createMockFile(),
        parsedData: [createMockEquipment()],
        parseError: null,
        validationErrors: [],
      })

      mockCallRpc.mockRejectedValue(new Error('Database connection failed'))

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      fireEvent.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Lỗi',
          })
        )
      })

      await waitFor(() => {
        expect(mockSetSubmitError).toHaveBeenCalledWith('Database connection failed')
      })
    })

    it('should not call RPC when parsed data is empty', async () => {
      setupMockHookState({
        status: 'parsed',
        selectedFile: createMockFile(),
        parsedData: [],
        parseError: null,
        validationErrors: [],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      // Button should be disabled
      expect(screen.getByTestId('submit-button')).toBeDisabled()
      expect(mockCallRpc).not.toHaveBeenCalled()
    })

    it('should clean undefined values from payload', async () => {
      const equipmentWithUndefined = {
        ma_thiet_bi: 'EQ001',
        ten_thiet_bi: 'May sieu am',
        khoa_phong_quan_ly: 'Khoa Noi',
        nguoi_dang_truc_tiep_quan_ly: 'A',
        tinh_trang_hien_tai: 'Hoat dong',
        vi_tri_lap_dat: 'P1',
        model: undefined,
        serial: undefined,
      }

      setupMockHookState({
        status: 'parsed',
        selectedFile: createMockFile(),
        parsedData: [equipmentWithUndefined],
        parseError: null,
        validationErrors: [],
      })

      mockCallRpc.mockResolvedValue({
        success: true,
        inserted: 1,
        failed: 0,
        total: 1,
        details: [],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      fireEvent.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        const callArgs = mockCallRpc.mock.calls[0][0]
        const item = callArgs.args.p_items[0]
        // Should not have undefined keys
        expect(item).not.toHaveProperty('model')
        expect(item).not.toHaveProperty('serial')
        expect(item.ma_thiet_bi).toBe('EQ001')
      })
    })
  })

  describe('Integration with useBulkImportState', () => {
    it('should pass correct headerMap to hook', () => {
      setupMockHookState()

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(mockUseBulkImportState).toHaveBeenCalledWith(
        expect.objectContaining({
          headerMap: expect.objectContaining({
            'Mã thiết bị': 'ma_thiet_bi',
            'Tên thiết bị': 'ten_thiet_bi',
            'Model': 'model',
            'Serial': 'serial',
          }),
        })
      )
    })

    it('should pass transformRow function to hook', () => {
      setupMockHookState()

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(mockUseBulkImportState).toHaveBeenCalledWith(
        expect.objectContaining({
          transformRow: expect.any(Function),
        })
      )
    })

    it('should pass validateData function to hook', () => {
      setupMockHookState()

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(mockUseBulkImportState).toHaveBeenCalledWith(
        expect.objectContaining({
          validateData: expect.any(Function),
        })
      )
    })

    it('should pass acceptedExtensions to hook', () => {
      setupMockHookState()

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(mockUseBulkImportState).toHaveBeenCalledWith(
        expect.objectContaining({
          acceptedExtensions: '.xlsx, .xls, .csv',
        })
      )
    })
  })

  describe('Multiple Equipment Import', () => {
    it('should handle multiple equipment records', async () => {
      const equipment1 = createMockEquipment({ ma_thiet_bi: 'EQ001' })
      const equipment2 = createMockEquipment({ ma_thiet_bi: 'EQ002' })
      const equipment3 = createMockEquipment({ ma_thiet_bi: 'EQ003' })

      setupMockHookState({
        status: 'parsed',
        selectedFile: createMockFile(),
        parsedData: [equipment1, equipment2, equipment3],
        parseError: null,
        validationErrors: [],
      })

      mockCallRpc.mockResolvedValue({
        success: true,
        inserted: 3,
        failed: 0,
        total: 3,
        details: [],
      })

      render(
        <ImportEquipmentDialog
          open={true}
          onOpenChange={() => {}}
          onSuccess={() => {}}
        />
      )

      expect(screen.getByText('Nhap 3 thiet bi')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        const callArgs = mockCallRpc.mock.calls[0][0]
        expect(callArgs.args.p_items).toHaveLength(3)
      })
    })
  })
})
